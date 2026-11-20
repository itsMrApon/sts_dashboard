import 'server-only'
import { prismaClient } from '@/lib/prismaClient'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'

/**
 * The agent room an offer's AI room runs in. By default that is the creator's business room, so
 * chat and voice are answered by the assistants picked in Services (Chat AI, Voice AI) in their
 * styles, with the offer's brief added. A product can override it with its own agent.
 */
export async function offerAgentRoomName(offer: { livekitAgentId: string | null; presenterId: string }): Promise<string | null> {
  if (offer.livekitAgentId) {
    const agent = await prismaClient.liveKitAgent.findUnique({ where: { id: offer.livekitAgentId }, select: { roomName: true } })
    if (agent?.roomName) return agent.roomName
  }
  return (await getCreatorBusiness(offer.presenterId))?.roomName ?? null
}
