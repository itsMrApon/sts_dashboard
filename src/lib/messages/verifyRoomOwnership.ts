import { auth } from '@clerk/nextjs/server'
import type { LiveKitAgent } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { startPerf, timeAsync } from '@/lib/dev/perf'

type ResolvedUserContext = {
  id: string
  clerkId: string
}

export type VerifyRoomOwnershipResult =
  | { ok: true; agent: LiveKitAgent | null }
  | { ok: false; reason: 'UNAUTHENTICATED' | 'FORBIDDEN' }

/**
 * Messaging room access: agent exists, or current user owns a MessageChannel for this roomName
 * (covers orphan channels after agent deletion and channel-only navigation).
 */
export async function verifyRoomOwnership(
  roomName: string,
  resolvedUser?: ResolvedUserContext,
): Promise<VerifyRoomOwnershipResult> {
  const timer = startPerf('messages.verifyRoomOwnership', { roomName })
  const clerkId =
    resolvedUser?.clerkId ??
    (await timeAsync('messages.verifyRoomOwnership.auth', () => auth())).userId
  if (!clerkId) {
    timer.end({ result: 'unauthenticated' })
    return { ok: false, reason: 'UNAUTHENTICATED' }
  }

  const user = resolvedUser
    ? { id: resolvedUser.id }
    : await timeAsync('messages.verifyRoomOwnership.user.findUnique', () =>
        prismaClient.user.findUnique({
          where: { clerkId },
          select: { id: true },
        }),
      )
  if (!user) {
    timer.end({ result: 'missing-user' })
    return { ok: false, reason: 'UNAUTHENTICATED' }
  }

  const agent = await timeAsync('messages.verifyRoomOwnership.liveKitAgent.findUnique', () =>
    prismaClient.liveKitAgent.findUnique({
      where: { roomName },
    }),
  )

  if (agent) {
    timer.end({ result: 'agent' })
    return { ok: true, agent }
  }

  const userScopedChannel = await timeAsync(
    'messages.verifyRoomOwnership.messageChannel.findFirst',
    () =>
      prismaClient.messageChannel.findFirst({
        where: {
          roomName,
          OR: [{ userId: user.id }, { publishProfile: { userId: user.id } }],
        },
        select: { id: true },
      }),
  )

  if (userScopedChannel) {
    timer.end({ result: 'channel' })
    return { ok: true, agent: null }
  }

  timer.end({ result: 'forbidden' })
  return { ok: false, reason: 'FORBIDDEN' }
}
