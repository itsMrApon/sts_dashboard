import 'server-only'
import { ChannelStatus, Platform } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { offerAgentRoomName } from '@/lib/offers/offerAgent'
import { offerChatSessionId } from './offerAi'

/**
 * The creator answering a buyer's project chat from outside the app (a reply to a Telegram
 * alert). In the app, project chats live in Messages, which shows the AI's replies and has
 * "Take over from Chat AI".
 */

const MESSAGE_LIMIT = 50
const REPLY_MAX = 2000

export type CreatorReply = { role: 'assistant'; content: string; from: 'creator'; timestamp: string }

/**
 * Stores the reply in the same conversation the buyer's chat reads (the AI sees it as history)
 * and takes the chat over, so the AI stays quiet until the creator hands it back in Messages.
 */
export async function appendCreatorReply(
  webinarId: string,
  userId: string,
  contactId: string,
  text: string,
): Promise<{ ok: true; message: CreatorReply } | { ok: false; error: string }> {
  const content = text.trim().slice(0, REPLY_MAX)
  if (!content) return { ok: false, error: 'Type a message' }
  const webinar = await prismaClient.webinar.findFirst({
    where: { id: webinarId, presenterId: userId, deletedAt: null },
    select: { slug: true, livekitAgentId: true },
  })
  if (!webinar?.slug) return { ok: false, error: 'Project not found' }
  const roomName = await offerAgentRoomName({ livekitAgentId: webinar.livekitAgentId, presenterId: userId })
  if (!roomName) return { ok: false, error: 'This project has no AI agent yet' }
  const contact = await prismaClient.contact.findFirst({ where: { id: contactId, userId }, select: { id: true } })
  if (!contact) return { ok: false, error: 'Buyer not found' }

  const channel = await prismaClient.messageChannel.upsert({
    where: { roomName_platform: { roomName, platform: Platform.WEB } },
    create: { roomName, platform: Platform.WEB, status: ChannelStatus.ACTIVE, userId, accountLabel: 'Website' },
    update: {},
    select: { id: true, platform: true },
  })
  const externalId = offerChatSessionId(webinar.slug, contact.id)
  const conversation = await prismaClient.messageConversation.findFirst({
    where: { channelId: channel.id, externalId },
    select: { messages: true },
  })
  const stored = Array.isArray(conversation?.messages) ? (conversation.messages as unknown[]) : []
  const message: CreatorReply = { role: 'assistant', content, from: 'creator', timestamp: new Date().toISOString() }
  const messages = [...stored, message].slice(-MESSAGE_LIMIT) as object[]
  await prismaClient.messageConversation.upsert({
    where: { channelId_externalId: { channelId: channel.id, externalId } },
    create: { channelId: channel.id, externalId, platform: channel.platform, messages, aiPausedAt: new Date() },
    update: { messages, aiPausedAt: new Date() },
  })
  return { ok: true, message }
}

