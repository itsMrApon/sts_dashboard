import { auth } from '@clerk/nextjs/server'
import type { LiveKitAgent } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'

export type VerifyRoomOwnershipResult =
  | { ok: true; agent: LiveKitAgent | null }
  | { ok: false; reason: 'UNAUTHENTICATED' | 'FORBIDDEN' }

/**
 * Messaging room access: agent exists, or current user owns a MessageChannel for this roomName
 * (covers orphan channels after agent deletion and channel-only navigation).
 */
export async function verifyRoomOwnership(roomName: string): Promise<VerifyRoomOwnershipResult> {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return { ok: false, reason: 'UNAUTHENTICATED' }
  }

  const user = await prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!user) {
    return { ok: false, reason: 'UNAUTHENTICATED' }
  }

  const agent = await prismaClient.liveKitAgent.findUnique({
    where: { roomName },
  })

  if (agent) {
    return { ok: true, agent }
  }

  const userScopedChannel = await prismaClient.messageChannel.findFirst({
    where: {
      roomName,
      OR: [{ userId: user.id }, { business: { userId: user.id } }],
    },
    select: { id: true },
  })

  if (userScopedChannel) {
    return { ok: true, agent: null }
  }

  return { ok: false, reason: 'FORBIDDEN' }
}
