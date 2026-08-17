import { prismaClient } from '@/lib/prismaClient'

/**
 * User whose API credentials (e.g. Gemini in /ai-agents/config) apply to this room.
 * Mirrors logic needed for both web chat and LiveKit agent-config.
 */
export async function resolveRoomOwnerUserId(
  agentId: string,
  roomName: string,
): Promise<string | null> {
  const businessLink = await prismaClient.publishAgent.findFirst({
    where: { agentId },
    select: { publishProfile: { select: { userId: true } } },
  })
  if (businessLink?.publishProfile?.userId) {
    return businessLink.publishProfile.userId
  }

  const channels = await prismaClient.messageChannel.findMany({
    where: { roomName },
    select: { userId: true, publishProfileId: true, status: true },
    orderBy: { updatedAt: 'desc' },
  })

  const preferred =
    channels.find((c) => c.status === 'ACTIVE' && (c.publishProfileId != null || c.userId != null)) ||
    channels.find((c) => c.publishProfileId != null || c.userId != null) ||
    channels[0]

  if (preferred?.userId) {
    return preferred.userId
  }

  if (preferred?.publishProfileId) {
    const biz = await prismaClient.publishProfile.findFirst({
      where: { id: preferred.publishProfileId },
      select: { userId: true },
    })
    return biz?.userId ?? null
  }

  return null
}
