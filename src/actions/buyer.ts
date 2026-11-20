'use server'

import { latestReplayUrl } from '@/lib/stream/replays'
import { headers } from 'next/headers'
import { AttendedTypeEnum, OrderModeKind, type Attendee } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { checkRateLimit, consumeDailyQuota, EMBED_DAILY_QUOTAS } from '@/lib/embed/rateLimit'
import { clientIp } from '@/lib/embed/clientIp'
import { loadPublicOffer } from '@/lib/offers/publicOffer'
import { clearBuyerContact, getBuyerContactId, setBuyerContact } from '@/lib/offers/buyerSession'
import { normalizeEmail, normalizeName, normalizePhone, normalizeSource } from '@/lib/offers/leadInput'
import { startOfferCheckout } from '@/lib/offers/offerOrders'
import { createOfferVoiceSession, loadOfferChatHistory, replyToOfferChat } from '@/lib/offers/offerAi'
import { registerContactOnOffer } from '@/lib/offers/offerAttendance'
import type { ConnectionDetails } from '@/lib/livekit/livekitVoiceAgent'
import { checkVoiceKeysForRoom, voiceKeyErrorMessage } from '@/lib/credentials/voiceKeyCheck'
import type { BuyerContactView, OfferChatMessage } from '@/lib/offers/publicOfferTypes'

/**
 * Buyer-side actions for /o/[slug] and /pay/[slug]. No Clerk session: buyers are identified by
 * the signed per-creator contact cookie. Every action is rate limited per IP.
 */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const TOO_MANY = 'Too many tries. Please wait a minute and try again.'

async function allow(scope: string, limit: number, windowMs = 60_000): Promise<boolean> {
  const ip = clientIp(await headers())
  const result = await checkRateLimit(`buyer:${scope}:${ip}`, limit, windowMs)
  return result.ok
}

export async function captureLead(input: {
  slug: string
  method: 'email' | 'whatsapp'
  value: string
  name?: string
  source?: string | null
}): Promise<Result<{ contact: BuyerContactView }>> {
  if (!(await allow('lead', 10))) return { ok: false, error: TOO_MANY }
  const offer = await loadPublicOffer(input.slug)
  if (!offer?.live) return { ok: false, error: 'This offer is not available' }

  const name = normalizeName(input.name)
  const source = normalizeSource(input.source) ?? 'link'
  const email = input.method === 'email' ? normalizeEmail(input.value ?? '') : null
  const phone = input.method === 'whatsapp' ? normalizePhone(input.value ?? '') : null
  if (input.method === 'email' && !email) return { ok: false, error: 'Enter a valid email' }
  if (input.method === 'whatsapp' && !phone) return { ok: false, error: 'Enter your WhatsApp number with country code' }

  const where = email
    ? { userId_email: { userId: offer.creatorUserId, email } }
    : { userId_phone: { userId: offer.creatorUserId, phone: phone as string } }
  const contact = await prismaClient.contact.upsert({
    where,
    create: { userId: offer.creatorUserId, email, phone, name, source },
    // Keep the first source; only fill in a name the contact did not have.
    update: name ? { name } : {},
    select: { id: true, name: true, email: true, phone: true },
  })
  await setBuyerContact(offer.creatorUserId, contact.id)
  // Shows up as "Registered" in the creator's pipeline for this offer.
  await registerContactOnOffer(offer.id, contact)
  return { ok: true, contact: { name: contact.name, email: contact.email, phone: contact.phone } }
}

/** "Not you?" on the share page. */
export async function forgetBuyer(input: { slug: string }): Promise<Result> {
  const offer = await loadPublicOffer(input.slug)
  if (offer) await clearBuyerContact(offer.creatorUserId)
  return { ok: true }
}

/**
 * Checkout from the share page (lead required). `via` records which way to order led here:
 * the Buy now card, or the order button the AI (chat, voice, wizard) brought up.
 */
export async function startBuyerCheckout(input: {
  slug: string
  offerPriceId: string | null
  source?: string | null
  via?: 'INSTANT_CHECKOUT' | 'AI_ASSISTANT'
}): Promise<Result<{ url: string }>> {
  if (!(await allow('checkout', 10))) return { ok: false, error: TOO_MANY }
  const via = input.via === 'AI_ASSISTANT' ? OrderModeKind.AI_ASSISTANT : OrderModeKind.INSTANT_CHECKOUT
  const offer = await loadPublicOffer(input.slug)
  if (!offer?.live || !offer.modes[via]) return { ok: false, error: 'This offer is not available' }
  const contactId = await getBuyerContactId(offer.creatorUserId)
  if (!contactId) return { ok: false, error: 'Enter your email or WhatsApp first' }

  const result = await startOfferCheckout({
    offer,
    offerPriceId: input.offerPriceId,
    contactId,
    orderMode: via,
    source: normalizeSource(input.source),
  })
  return result.ok ? { ok: true, url: result.url } : result
}

/** Direct pay link: no lead form, straight to Stripe. */
export async function startDirectPay(input: {
  slug: string
  offerPriceId: string | null
  source?: string | null
}): Promise<Result<{ url: string }>> {
  if (!(await allow('pay', 10))) return { ok: false, error: TOO_MANY }
  const offer = await loadPublicOffer(input.slug)
  if (!offer?.live || !offer.modes.DIRECT_PAY) return { ok: false, error: 'This payment link is not active' }

  // If the buyer already left their details on this creator's link, attach them anyway.
  const contactId = await getBuyerContactId(offer.creatorUserId)
  const result = await startOfferCheckout({
    offer,
    offerPriceId: input.offerPriceId,
    contactId,
    orderMode: OrderModeKind.DIRECT_PAY,
    source: normalizeSource(input.source) ?? 'pay-link',
  })
  return result.ok ? { ok: true, url: result.url } : result
}

/**
 * Live link: saves the buyer's seat (their lead must be captured first). The live room still
 * identifies visitors by Attendee, so the returned attendee goes into the attendee store.
 */
export async function joinLiveWaitlist(input: {
  slug: string
}): Promise<Result<{ attendee: Attendee; status: string }>> {
  if (!(await allow('enter', 20))) return { ok: false, error: TOO_MANY }
  const offer = await loadPublicOffer(input.slug)
  if (!offer?.live || !offer.modes.LIVE_HOST) return { ok: false, error: 'This offer has no live session' }

  const contactId = await getBuyerContactId(offer.creatorUserId)
  const contact = contactId
    ? await prismaClient.contact.findFirst({
        where: { id: contactId, userId: offer.creatorUserId },
        select: { email: true, phone: true, name: true },
      })
    : null
  if (!contact) return { ok: false, error: 'Enter your email or WhatsApp first' }

  const attendee = await registerContactOnOffer(offer.id, contact)
  return { ok: true, attendee, status: offer.webinarStatus }
}

/** The waiting room polls this to open the doors when the creator goes live. */
export async function getLiveStatus(input: { slug: string }): Promise<Result<{ status: string; startTime: string }>> {
  if (!(await allow('live-status', 30))) return { ok: false, error: TOO_MANY }
  const offer = await loadPublicOffer(input.slug)
  if (!offer?.live || !offer.modes.LIVE_HOST) return { ok: false, error: 'This offer has no live session' }
  return { ok: true, status: offer.webinarStatus, startTime: offer.startTime }
}

/** The buyer's contact for this offer's creator (from the signed cookie), or null. */
async function buyerContact(creatorUserId: string) {
  const contactId = await getBuyerContactId(creatorUserId)
  if (!contactId) return null
  return prismaClient.contact.findFirst({
    where: { id: contactId, userId: creatorUserId },
    select: { id: true, name: true },
  })
}

const CHAT_MESSAGE_MAX = 2000

/** AI chat on the share page. `showOrder` is true when the AI decided the buyer is ready. */
export async function sendOfferChat(input: {
  slug: string
  message: string
}): Promise<Result<{ reply: string | null; showOrder: boolean }>> {
  const message = input.message?.trim().slice(0, CHAT_MESSAGE_MAX)
  if (!message) return { ok: false, error: 'Type a message' }
  if (!(await allow('chat', 20))) return { ok: false, error: TOO_MANY }

  const offer = await loadPublicOffer(input.slug)
  if (!offer?.live || !offer.modes.AI_ASSISTANT || !offer.aiServices.includes('CHAT')) {
    return { ok: false, error: 'Chat is not available for this offer' }
  }
  const contact = await buyerContact(offer.creatorUserId)
  if (!contact) return { ok: false, error: 'Enter your email or WhatsApp first' }
  if (!offer.agentRoomName) return { ok: false, error: 'Chat is not set up for this offer' }

  const quota = await consumeDailyQuota(`offer-chat:${offer.agentRoomName}`, EMBED_DAILY_QUOTAS.chat)
  if (!quota.ok) return { ok: false, error: 'The assistant is busy today. Please try again tomorrow.' }

  const result = await replyToOfferChat(offer, contact.id, message)
  return result.ok ? { ok: true, reply: result.reply, showOrder: result.showOrder } : result
}

/** The buyer's chat, re-read so replies the creator types from the pipeline show up. */
export async function pollOfferChat(input: { slug: string }): Promise<Result<{ messages: OfferChatMessage[] }>> {
  if (!(await allow('chat-poll', 30))) return { ok: false, error: TOO_MANY }
  const offer = await loadPublicOffer(input.slug)
  if (!offer?.live || !offer.modes.AI_ASSISTANT || !offer.aiServices.includes('CHAT')) {
    return { ok: false, error: 'Chat is not available for this offer' }
  }
  const contact = await buyerContact(offer.creatorUserId)
  if (!contact) return { ok: false, error: 'Enter your email or WhatsApp first' }
  return { ok: true, messages: await loadOfferChatHistory(offer, contact.id) }
}

/** Voice call on the share page: a LiveKit token for a room that carries the offer. */
export async function startOfferVoice(input: { slug: string }): Promise<Result<{ connection: ConnectionDetails }>> {
  if (!(await allow('voice', 6))) return { ok: false, error: TOO_MANY }
  const offer = await loadPublicOffer(input.slug)
  if (!offer?.live || !offer.modes.AI_ASSISTANT || !offer.aiServices.includes('SPEAK')) {
    return { ok: false, error: 'Voice is not available for this offer' }
  }
  const contact = await buyerContact(offer.creatorUserId)
  if (!contact) return { ok: false, error: 'Enter your email or WhatsApp first' }
  if (!offer.agentRoomName) return { ok: false, error: 'Voice is not set up for this offer' }

  // Creators run voice on their own keys; stop here instead of opening a room no agent can serve.
  const keys = await checkVoiceKeysForRoom(offer.agentRoomName)
  if (!keys.ok) return { ok: false, error: await voiceKeyErrorMessage(keys) }

  const quota = await consumeDailyQuota(`offer-voice:${offer.agentRoomName}`, EMBED_DAILY_QUOTAS.voice)
  if (!quota.ok) return { ok: false, error: 'Voice is busy today. Please try chat instead.' }

  const connection = await createOfferVoiceSession(offer, contact)
  if (!connection) return { ok: false, error: 'Voice is not set up for this offer' }
  return { ok: true, connection }
}

/** The replay of an ended live session, when the host's recording is ready. */
export async function getLiveReplay(input: { slug: string }): Promise<Result<{ url: string | null }>> {
  if (!(await allow('replay', 10))) return { ok: false, error: TOO_MANY }
  const offer = await loadPublicOffer(input.slug)
  if (!offer?.live || offer.webinarStatus !== 'ENDED') return { ok: true, url: null }
  return { ok: true, url: await latestReplayUrl(offer.id) }
}

/**
 * "Drop offer" during a live webinar: the attendee's buy button. Only for attendees registered
 * on this webinar; recorded as a LIVE_HOST order (with the buyer's contact when they came via /o).
 */
export async function startLiveCheckout(input: {
  webinarId: string
  attendeeId: string
}): Promise<Result<{ url: string }>> {
  if (!(await allow('live-checkout', 10))) return { ok: false, error: TOO_MANY }
  const [webinar, attendance] = await Promise.all([
    prismaClient.webinar.findFirst({ where: { id: input.webinarId, deletedAt: null }, select: { slug: true } }),
    prismaClient.attendance.findUnique({
      where: { attendeeId_webinarId: { attendeeId: input.attendeeId, webinarId: input.webinarId } },
      select: { id: true },
    }),
  ])
  if (!webinar?.slug || !attendance) return { ok: false, error: 'Join the session first' }

  const offer = await loadPublicOffer(webinar.slug)
  if (!offer?.live) return { ok: false, error: 'This offer is not available' }
  const contactId = await getBuyerContactId(offer.creatorUserId)

  const result = await startOfferCheckout({
    offer,
    offerPriceId: null,
    contactId,
    orderMode: OrderModeKind.LIVE_HOST,
    source: 'live',
  })
  if (!result.ok) return result
  await prismaClient.attendance.update({
    where: { id: attendance.id },
    data: { attendedType: AttendedTypeEnum.ADDED_TO_CART },
  })
  return { ok: true, url: result.url }
}
