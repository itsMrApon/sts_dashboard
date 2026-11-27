import 'server-only'
import { getBusinessByRoomName } from '@/lib/business/creatorBusiness'
import { getBusinessServices } from '@/lib/services/serviceConfig'
import { chatStyleInstruction } from '@/lib/services/persona'
import { randomBytes } from 'node:crypto'
import { after } from 'next/server'
import { sendOfferChatAlert, type OfferChatAlertReason } from '@/lib/telegram/telegramAlerts'
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
    .map(({ role, content, from }) => (from === 'creator' ? { role, content, from } : { role, content }))
}

/** When a person has taken the chat over, stores the buyer's message and returns true (the AI stays quiet). */
/**
 * Where this buyer's chat stands before the AI answers. While a person has taken it over, the
 * buyer's message is stored for them and `paused` is true.
 */
async function chatStateBeforeReply(roomName: string, sessionId: string, message: string): Promise<'new' | 'active' | 'paused'> {
  const channel = await prismaClient.messageChannel.findUnique({
    where: { roomName_platform: { roomName, platform: Platform.WEB } },
    select: { id: true },
  })
  if (!channel) return 'new'
  const conversation = await prismaClient.messageConversation.findFirst({
    where: { channelId: channel.id, externalId: sessionId },
    select: { id: true, messages: true, aiPausedAt: true },
  })
  const stored = Array.isArray(conversation?.messages) ? (conversation.messages as object[]) : []
  if (!conversation?.aiPausedAt) return stored.length ? 'active' : 'new'
  const messages = [...stored, { role: 'user', content: message, timestamp: new Date().toISOString() }].slice(-100)
  await prismaClient.messageConversation.update({ where: { id: conversation.id }, data: { messages } })
  return 'paused'
}

/** Telegram alert after the buyer's reply has been sent (never delays or breaks the chat). */
function alertCreator(offer: PublicOfferRecord, contactId: string, message: string, reason: OfferChatAlertReason) {
  after(() =>
    sendOfferChatAlert({
      creatorUserId: offer.creatorUserId,
      webinarId: offer.id,
      offerSlug: offer.slug,
      offerTitle: offer.title,
      contactId,
      message,
      reason,
    }),
  )
}

export async function replyToOfferChat(
  offer: PublicOfferRecord,
  contactId: string,
  message: string,
): Promise<{ ok: true; reply: string | null; showOrder: boolean } | { ok: false; error: string }> {
  if (!offer.agentRoomName) return { ok: false, error: 'Chat is not set up for this offer' }
  // A person has taken this chat over (pipeline): keep the buyer's message for them, no AI reply.
  const state = await chatStateBeforeReply(offer.agentRoomName, offerChatSessionId(offer.slug, contactId), message)
  if (state === 'paused') {
    alertCreator(offer, contactId, message, 'waiting')
    return { ok: true, reply: null, showOrder: false }
  }
  // In the business room the Chat AI assistant from Services answers, in its style; a product's own
  // agent (an override) answers as itself. Either way the offer's brief is added.
  const business = await getBusinessByRoomName(offer.agentRoomName)
  const chat = business ? (await getBusinessServices(business.workspaceId)).chat : null
  const brief = buildOfferBrief(
    { title: offer.title, description: offer.description, businessName: offer.business.name, prices: offer.prices },
    'chat',
  )
  const result = await generateRoomChatReply({
    roomName: offer.agentRoomName,
    message,
    sessionId: offerChatSessionId(offer.slug, contactId),
    extraInstruction: chat ? `${chatStyleInstruction(chat.config)}\n\n${brief}` : brief,
    persona: chat?.agent ?? null,
    marker: CHAT_ORDER_MARKER,
    projectId: offer.id,
  })
  if (!result.ok) {
    console.warn('[offer-chat]', result.status, result.error)
    return { ok: false, error: 'The assistant is unavailable right now. Please try again.' }
  }
  if (result.markerFound) alertCreator(offer, contactId, message, 'ready')
  else if (state === 'new') alertCreator(offer, contactId, message, 'new')
  return { ok: true, reply: result.reply, showOrder: result.markerFound }
}

/**
 * A fresh LiveKit room per call whose name carries the offer slug and the buyer:
 *   <agentRoom>__offer__<slug>__<contactId without dashes><random>
 * The agent-config route reads the slug, adds the offer brief and turns on the show_order_button tool.
 * The voice agent files its transcript under this room name, so the pipeline can match calls to buyers.
 */
export async function createOfferVoiceSession(offer: PublicOfferRecord, contact: { id: string; name: string | null }) {
  if (!offer.agentRoomName) return null
  const suffix = `${contact.id.replace(/-/g, '').toLowerCase()}${randomBytes(4).toString('hex')}`
  return getLiveKitConnectionDetails({
    roomName: `${offer.agentRoomName}__offer__${offer.slug}__${suffix}`,
    participantName: contact.name || 'Guest',
    participantIdentity: `buyer_${suffix}`,
  })
}

/** Parses an offer voice room name back to its parts (used by the agent-config route). */
export function parseOfferRoomName(roomName: string): { baseRoomName: string; offerSlug: string } | null {
  const match = roomName.match(/^(.+)__offer__([a-z0-9-]{1,80})__[a-z0-9]+$/)
  return match ? { baseRoomName: match[1], offerSlug: match[2] } : null
}

/** The buyer (Contact id) behind an offer voice room, when the room carries one. */
export function contactIdFromOfferRoom(roomName: string): string | null {
  const match = roomName.match(/__offer__[a-z0-9-]{1,80}__([0-9a-f]{32})[0-9a-f]{8}$/)
  if (!match) return null
  const hex = match[1]
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
