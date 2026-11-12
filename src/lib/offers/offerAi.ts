import 'server-only'
import { randomBytes } from 'node:crypto'
import { Platform } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { generateRoomChatReply } from '@/lib/services/chatReply'
import { getLiveKitConnectionDetails } from '@/lib/livekit/livekitVoiceAgent'
import { buildOfferBrief, CHAT_ORDER_MARKER } from './offerAiBrief'
import type { PublicOfferRecord } from './publicOffer'
import type { OfferChatMessage } from './publicOfferTypes'

/**
 * The AI way to order on /o/[slug]: chat and voice against the offer's agent, both briefed with
 * the offer and both able to bring up the order button.
 */

/** One conversation per buyer per offer, stored on the agent's WEB channel (creator inbox). */
export function offerChatSessionId(slug: string, contactId: string): string {
  return `offer:${slug}:${contactId}`.slice(0, 128)
}

export async function loadOfferChatHistory(offer: PublicOfferRecord, contactId: string): Promise<OfferChatMessage[]> {
  if (!offer.agentRoomName) return []
  const channel = await prismaClient.messageChannel.findUnique({
    where: { roomName_platform: { roomName: offer.agentRoomName, platform: Platform.WEB } },
    select: { id: true },
  })
  if (!channel) return []
  const conversation = await prismaClient.messageConversation.findFirst({
    where: { channelId: channel.id, externalId: offerChatSessionId(offer.slug, contactId) },
    select: { messages: true },
  })
  const messages = Array.isArray(conversation?.messages) ? (conversation.messages as OfferChatMessage[]) : []
  return messages
    .filter((message) => (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string')
    .slice(-30)
    .map(({ role, content }) => ({ role, content }))
}

export async function replyToOfferChat(
  offer: PublicOfferRecord,
  contactId: string,
  message: string,
): Promise<{ ok: true; reply: string; showOrder: boolean } | { ok: false; error: string }> {
  if (!offer.agentRoomName) return { ok: false, error: 'Chat is not set up for this offer' }
  const result = await generateRoomChatReply({
    roomName: offer.agentRoomName,
    message,
    sessionId: offerChatSessionId(offer.slug, contactId),
    extraInstruction: buildOfferBrief(
      { title: offer.title, description: offer.description, businessName: offer.business.name, prices: offer.prices },
      'chat',
    ),
    marker: CHAT_ORDER_MARKER,
  })
  if (!result.ok) {
    console.warn('[offer-chat]', result.status, result.error)
    return { ok: false, error: 'The assistant is unavailable right now. Please try again.' }
  }
  return { ok: true, reply: result.reply, showOrder: result.markerFound }
}

/**
 * A fresh LiveKit room per call whose name carries the offer slug:
 *   <agentRoom>__offer__<slug>__<random>
 * The agent-config route reads the slug, adds the offer brief and turns on the show_order_button tool.
 */
export async function createOfferVoiceSession(offer: PublicOfferRecord, contact: { id: string; name: string | null }) {
  if (!offer.agentRoomName) return null
  const suffix = randomBytes(4).toString('hex')
  return getLiveKitConnectionDetails({
    roomName: `${offer.agentRoomName}__offer__${offer.slug}__${suffix}`,
    participantName: contact.name || 'Guest',
    participantIdentity: `buyer_${contact.id.slice(0, 8)}_${suffix}`,
  })
}

/** Parses an offer voice room name back to its parts (used by the agent-config route). */
export function parseOfferRoomName(roomName: string): { baseRoomName: string; offerSlug: string } | null {
  const match = roomName.match(/^(.+)__offer__([a-z0-9-]{1,80})__[a-z0-9]+$/)
  return match ? { baseRoomName: match[1], offerSlug: match[2] } : null
}
