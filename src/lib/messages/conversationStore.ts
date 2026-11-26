import 'server-only'
import { ChannelStatus, Platform } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'

/**
 * Conversations live in MessageConversation on the business room's WEB channel, one per person
 * per source, keyed by externalId: `whatsapp:<phone>`, `email:<address>`, `offer:<slug>:<contact>`
 * or a website chat session. The AI's chat turns already write here; these helpers let the
 * inbox add messages that the AI did not answer (AI off, taken over) and the creator's replies.
 */

export type StoredMessage = {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  /** 'creator' when typed by the creator; 'agent' when sent after an AI-agent request was approved. */
  from?: 'creator' | 'agent'
  /** Emails only. */
  subject?: string
}

const MESSAGE_LIMIT = 200

export function readStoredMessages(value: unknown): StoredMessage[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (m): m is StoredMessage =>
      !!m && typeof m === 'object' && ((m as StoredMessage).role === 'user' || (m as StoredMessage).role === 'assistant') && typeof (m as StoredMessage).content === 'string',
  )
}

export async function businessWebChannel(roomName: string, userId: string) {
  return prismaClient.messageChannel.upsert({
    where: { roomName_platform: { roomName, platform: Platform.WEB } },
    create: { roomName, platform: Platform.WEB, status: ChannelStatus.ACTIVE, userId, accountLabel: 'Website' },
    update: {},
    select: { id: true },
  })
}

/**
 * Appends messages to one conversation. `pause: true` takes the chat over (the AI stays quiet),
 * `false` hands it back, undefined leaves it as it is.
 */
export async function appendToConversation(input: {
  roomName: string
  userId: string
  externalId: string
  messages: StoredMessage[]
  pause?: boolean
}) {
  const channel = await businessWebChannel(input.roomName, input.userId)
  const existing = await prismaClient.messageConversation.findFirst({
    where: { channelId: channel.id, externalId: input.externalId },
    select: { messages: true },
  })
  const messages = [...readStoredMessages(existing?.messages), ...input.messages].slice(-MESSAGE_LIMIT) as object[]
  const pausedAt = input.pause === undefined ? undefined : input.pause ? new Date() : null
  return prismaClient.messageConversation.upsert({
    where: { channelId_externalId: { channelId: channel.id, externalId: input.externalId } },
    create: { channelId: channel.id, externalId: input.externalId, platform: Platform.WEB, messages, aiPausedAt: pausedAt ?? null },
    update: { messages, ...(pausedAt === undefined ? {} : { aiPausedAt: pausedAt }) },
    select: { id: true },
  })
}

/** Appends to an existing conversation wherever it lives (a project can use its own AI room). */
export async function appendToConversationById(conversationId: string, messages: StoredMessage[], opts: { pause?: boolean } = {}) {
  const existing = await prismaClient.messageConversation.findUnique({ where: { id: conversationId }, select: { messages: true } })
  if (!existing) throw new Error('That conversation is gone.')
  const next = [...readStoredMessages(existing.messages), ...messages].slice(-MESSAGE_LIMIT) as object[]
  await prismaClient.messageConversation.update({
    where: { id: conversationId },
    data: { messages: next, ...(opts.pause === undefined ? {} : { aiPausedAt: opts.pause ? new Date() : null }) },
  })
}
