import 'server-only'
import { ChannelStatus, Platform } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { contactIdFromOfferRoom, offerChatSessionId } from './offerAi'
import { phoneFromAttendeeEmail } from './offerAttendance'
import type {
  PipelineCall,
  PipelineMessage,
  PipelineOrderStatus,
  PipelinePerson,
  PipelineThread,
  PipelineView,
} from './offerPipelineTypes'

/**
 * The creator's view of one offer: everyone who registered (share link or Live link), what they
 * said to the AI by chat or voice, and whether they paid. Every read is scoped to the owner.
 */

const MESSAGE_LIMIT = 50
const REPLY_MAX = 2000

type OwnedOffer = {
  id: string
  title: string
  slug: string | null
  businessName: string
  agentRoomName: string | null
  userId: string
}

async function loadOwnedOffer(webinarId: string, userId: string): Promise<OwnedOffer | null> {
  const webinar = await prismaClient.webinar.findFirst({
    where: { id: webinarId, presenterId: userId, deletedAt: null },
    select: {
      id: true,
      title: true,
      slug: true,
      livekitAgentId: true,
      presenter: { select: { name: true, publishProfile: { select: { name: true } } } },
    },
  })
  if (!webinar) return null
  const agent = webinar.livekitAgentId
    ? await prismaClient.liveKitAgent.findUnique({ where: { id: webinar.livekitAgentId }, select: { roomName: true } })
    : null
  return {
    id: webinar.id,
    title: webinar.title,
    slug: webinar.slug,
    businessName: webinar.presenter.publishProfile?.name || webinar.presenter.name,
    agentRoomName: agent?.roomName ?? null,
    userId,
  }
}

function chatChannel(roomName: string) {
  return prismaClient.messageChannel.findUnique({
    where: { roomName_platform: { roomName, platform: Platform.WEB } },
    select: { id: true },
  })
}

function readMessages(value: unknown): PipelineMessage[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (item): item is PipelineMessage =>
        !!item &&
        typeof item === 'object' &&
        ((item as PipelineMessage).role === 'user' || (item as PipelineMessage).role === 'assistant') &&
        typeof (item as PipelineMessage).content === 'string',
    )
    .map(({ role, content, from, timestamp }) => ({
      role,
      content,
      ...(from === 'creator' ? { from } : {}),
      ...(typeof timestamp === 'string' ? { timestamp } : {}),
    }))
}

const PAID_RANK: Record<PipelineOrderStatus, number> = {
  PAID: 5,
  DEPOSIT_PAID: 4,
  PENDING: 3,
  REFUNDED: 2,
  FAILED: 1,
  CANCELED: 0,
}

const later = (a: string, b: string | null | undefined) => (b && b > a ? b : a)

export async function loadOfferPipeline(webinarId: string, userId: string): Promise<PipelineView | null> {
  const offer = await loadOwnedOffer(webinarId, userId)
  if (!offer) return null

  const channel = offer.agentRoomName ? await chatChannel(offer.agentRoomName) : null
  const chatPrefix = offer.slug ? offerChatSessionId(offer.slug, '') : null
  const [attendances, conversations, calls, orders] = await Promise.all([
    prismaClient.attendance.findMany({
      where: { webinarId },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { createdAt: true, user: { select: { id: true, email: true, name: true } } },
    }),
    channel && chatPrefix
      ? prismaClient.messageConversation.findMany({
          where: { channelId: channel.id, externalId: { startsWith: chatPrefix } },
          orderBy: { updatedAt: 'desc' },
          take: 500,
          select: { externalId: true, messages: true, updatedAt: true },
        })
      : [],
    offer.slug
      ? prismaClient.callTranscript.findMany({
          where: { userId, roomName: { contains: `__offer__${offer.slug}__` } },
          orderBy: { createdAt: 'desc' },
          take: 500,
          select: { roomName: true, createdAt: true },
        })
      : [],
    prismaClient.order.findMany({
      where: { webinarId, contactId: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { contactId: true, status: true, amountPaidCents: true, amountTotalCents: true, createdAt: true },
    }),
  ])

  const chatByContact = new Map<string, { messages: PipelineMessage[]; updatedAt: string }>()
  for (const conversation of conversations) {
    const contactId = chatPrefix ? conversation.externalId.slice(chatPrefix.length) : ''
    if (contactId) {
      chatByContact.set(contactId, {
        messages: readMessages(conversation.messages),
        updatedAt: conversation.updatedAt.toISOString(),
      })
    }
  }
  const callsByContact = new Map<string, { count: number; latest: string }>()
  for (const call of calls) {
    const contactId = contactIdFromOfferRoom(call.roomName)
    if (!contactId) continue
    const entry = callsByContact.get(contactId)
    const at = call.createdAt.toISOString()
    callsByContact.set(contactId, { count: (entry?.count ?? 0) + 1, latest: later(at, entry?.latest) })
  }
  const orderByContact = new Map<string, (typeof orders)[number]>()
  for (const order of orders) {
    if (!order.contactId) continue
    const current = orderByContact.get(order.contactId)
    if (!current || PAID_RANK[order.status] > PAID_RANK[current.status]) orderByContact.set(order.contactId, order)
  }

  const emails = attendances.map((row) => row.user.email).filter((email) => !phoneFromAttendeeEmail(email))
  const phones = attendances.map((row) => phoneFromAttendeeEmail(row.user.email)).filter((phone): phone is string => !!phone)
  const contactIds = [...new Set([...chatByContact.keys(), ...callsByContact.keys(), ...orderByContact.keys()])].filter((id) =>
    /^[0-9a-f-]{36}$/i.test(id),
  )
  const contacts = await prismaClient.contact.findMany({
    where: {
      userId,
      OR: [{ id: { in: contactIds } }, { email: { in: emails } }, { phone: { in: phones } }],
    },
    select: { id: true, name: true, email: true, phone: true, source: true, createdAt: true },
  })
  const contactByEmail = new Map(contacts.filter((c) => c.email).map((c) => [c.email as string, c]))
  const contactByPhone = new Map(contacts.filter((c) => c.phone).map((c) => [c.phone as string, c]))

  const people = new Map<string, PipelinePerson>()
  const personFor = (contact: (typeof contacts)[number]): PipelinePerson => {
    const existing = people.get(contact.id)
    if (existing) return existing
    const person: PipelinePerson = {
      key: contact.id,
      contactId: contact.id,
      name: contact.name || contact.email?.split('@')[0] || contact.phone || 'Guest',
      email: contact.email,
      phone: contact.phone,
      source: contact.source,
      registeredAt: null,
      lastActivityAt: contact.createdAt.toISOString(),
      chat: null,
      voiceCalls: 0,
      order: null,
    }
    people.set(contact.id, person)
    return person
  }

  for (const row of attendances) {
    const phone = phoneFromAttendeeEmail(row.user.email)
    const contact = phone ? contactByPhone.get(phone) : contactByEmail.get(row.user.email)
    const at = row.createdAt.toISOString()
    if (contact) {
      const person = personFor(contact)
      person.registeredAt = person.registeredAt && person.registeredAt < at ? person.registeredAt : at
      person.lastActivityAt = later(person.lastActivityAt, at)
      continue
    }
    // Signed up on an older waitlist form: no contact record, only the attendee.
    people.set(`attendee:${row.user.id}`, {
      key: `attendee:${row.user.id}`,
      contactId: null,
      name: row.user.name || row.user.email.split('@')[0],
      email: phone ? null : row.user.email,
      phone,
      source: null,
      registeredAt: at,
      lastActivityAt: at,
      chat: null,
      voiceCalls: 0,
      order: null,
    })
  }

  for (const contact of contacts) {
    const chat = chatByContact.get(contact.id)
    const voice = callsByContact.get(contact.id)
    const order = orderByContact.get(contact.id)
    if (!chat && !voice && !order && !people.has(contact.id)) continue
    const person = personFor(contact)
    if (chat) {
      const last = chat.messages.at(-1)
      person.chat = {
        count: chat.messages.length,
        updatedAt: chat.updatedAt,
        lastMessage: last ? last.content.slice(0, 140) : null,
        fromBuyerLast: last?.role === 'user',
      }
      person.lastActivityAt = later(person.lastActivityAt, chat.updatedAt)
    }
    if (voice) {
      person.voiceCalls = voice.count
      person.lastActivityAt = later(person.lastActivityAt, voice.latest)
    }
    if (order) {
      person.order = {
        status: order.status,
        amountPaidCents: order.amountPaidCents,
        amountTotalCents: order.amountTotalCents,
      }
      person.lastActivityAt = later(person.lastActivityAt, order.createdAt.toISOString())
    }
  }

  return {
    offer: {
      id: offer.id,
      title: offer.title,
      slug: offer.slug,
      businessName: offer.businessName,
      canChat: !!offer.agentRoomName && !!offer.slug,
    },
    people: [...people.values()].sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1)),
  }
}

/** One buyer's chat and voice calls on this offer. */
export async function loadPipelineThread(webinarId: string, userId: string, contactId: string): Promise<PipelineThread | null> {
  const offer = await loadOwnedOffer(webinarId, userId)
  if (!offer?.slug) return null
  const contact = await prismaClient.contact.findFirst({ where: { id: contactId, userId }, select: { id: true } })
  if (!contact) return null

  const channel = offer.agentRoomName ? await chatChannel(offer.agentRoomName) : null
  const [conversation, calls] = await Promise.all([
    channel
      ? prismaClient.messageConversation.findFirst({
          where: { channelId: channel.id, externalId: offerChatSessionId(offer.slug, contact.id) },
          select: { messages: true },
        })
      : null,
    prismaClient.callTranscript.findMany({
      where: {
        userId,
        roomName: { contains: `__offer__${offer.slug}__${contact.id.replace(/-/g, '').toLowerCase()}` },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, createdAt: true, duration: true, summary: true, outcome: true, transcript: true },
    }),
  ])

  return {
    messages: readMessages(conversation?.messages),
    calls: calls.map(
      (call): PipelineCall => ({
        id: call.id,
        createdAt: call.createdAt.toISOString(),
        durationSec: call.duration,
        summary: call.summary,
        outcome: call.outcome,
        lines: (Array.isArray(call.transcript) ? call.transcript : [])
          .filter(
            (line): line is { role: 'user' | 'agent'; text: string } =>
              !!line &&
              typeof line === 'object' &&
              ((line as { role?: string }).role === 'user' || (line as { role?: string }).role === 'agent') &&
              typeof (line as { text?: unknown }).text === 'string',
          )
          .map(({ role, text }) => ({ role, text })),
      }),
    ),
  }
}

/**
 * The creator joins a buyer's chat: the message is stored in the same conversation the buyer's
 * chat panel reads (and the AI sees it as part of the history on the next turn).
 */
export async function appendCreatorReply(
  webinarId: string,
  userId: string,
  contactId: string,
  text: string,
): Promise<{ ok: true; message: PipelineMessage } | { ok: false; error: string }> {
  const content = text.trim().slice(0, REPLY_MAX)
  if (!content) return { ok: false, error: 'Type a message' }
  const offer = await loadOwnedOffer(webinarId, userId)
  if (!offer?.slug) return { ok: false, error: 'Offer not found' }
  if (!offer.agentRoomName) return { ok: false, error: 'Pick an AI agent for this offer first (Ways to order → AI sales assistant)' }
  const contact = await prismaClient.contact.findFirst({ where: { id: contactId, userId }, select: { id: true } })
  if (!contact) return { ok: false, error: 'Buyer not found' }

  const channel = await prismaClient.messageChannel.upsert({
    where: { roomName_platform: { roomName: offer.agentRoomName, platform: Platform.WEB } },
    create: {
      roomName: offer.agentRoomName,
      platform: Platform.WEB,
      status: ChannelStatus.ACTIVE,
      userId,
      accountLabel: 'Website',
    },
    update: {},
    select: { id: true, platform: true },
  })
  const externalId = offerChatSessionId(offer.slug, contact.id)
  const conversation = await prismaClient.messageConversation.findFirst({
    where: { channelId: channel.id, externalId },
    select: { messages: true },
  })
  const stored = Array.isArray(conversation?.messages) ? (conversation.messages as unknown[]) : []
  const message: PipelineMessage = { role: 'assistant', content, from: 'creator', timestamp: new Date().toISOString() }
  const messages = [...stored, message].slice(-MESSAGE_LIMIT) as object[]
  await prismaClient.messageConversation.upsert({
    where: { channelId_externalId: { channelId: channel.id, externalId } },
    create: { channelId: channel.id, externalId, platform: channel.platform, messages },
    update: { messages },
  })
  return { ok: true, message }
}
