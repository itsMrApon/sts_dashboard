import { prismaClient } from '@/lib/prismaClient'

/**
 * User whose API credentials (e.g. Gemini in /ai-agents/config) apply to this room.
 * Mirrors logic needed for both web chat and LiveKit agent-config.
 */
export async function resolveRoomOwnerUserId(
  agentId: string,
  roomName: string,
): Promise<string | null> {
  const businessLink = await prismaClient.businessAgent.findFirst({
    where: { agentId },
    select: { business: { select: { userId: true } } },
  })
  if (businessLink?.business?.userId) {
    return businessLink.business.userId
  }

  const channels = await prismaClient.messageChannel.findMany({
    where: { roomName },
    select: { userId: true, businessId: true, status: true },
    orderBy: { updatedAt: 'desc' },
  })

  const preferred =
    channels.find((c) => c.status === 'ACTIVE' && (c.businessId != null || c.userId != null)) ||
    channels.find((c) => c.businessId != null || c.userId != null) ||
    channels[0]

  if (preferred?.userId) {
    return preferred.userId
  }

  if (preferred?.businessId) {
    const biz = await prismaClient.business.findFirst({
      where: { id: preferred.businessId },
      select: { userId: true },
    })
    return biz?.userId ?? null
  }

  return null
}
