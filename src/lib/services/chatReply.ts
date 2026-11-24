import 'server-only'
import { ChannelStatus, Platform } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { generateReply } from '@/lib/messages/geminiText'
import { buildAgentContext } from '@/lib/messages/buildAgentContext'
import { getUserVoiceCredentialByUserId } from '@/lib/voiceCredentialsRepo'
import { decryptToken } from '@/lib/messages/encrypt'
import { resolveRoomOwnerUserId } from '@/lib/messages/resolveRoomOwnerUserId'

type StoredMessage = {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  /** 'creator' when typed by the creator from the pipeline. */
  from?: 'creator'
}

const HISTORY_LIMIT = 50

function safeDecrypt(value: string | null | undefined): string | null {
  try {
    return decryptToken(value)
  } catch {
    return null
  }
}

export type ChatReplyLinks = {
  roomJoinLink: string | null
  buyNowLink: string | null
  voiceAgentLinks: { name: string; url: string }[]
  productLinks: { name: string; url: string; buyUrl?: string }[]
  socialAccounts: { platform: string; label: string; url?: string }[]
}

export type ChatReplyResult =
  | ({ ok: true; reply: string; markerFound: boolean } & ChatReplyLinks)
  | { ok: false; status: number; error: string; code?: string }

/**
 * One chat turn against a room's AI: loads context + history, calls the LLM, persists the turn.
 * Shared by the hosted chat route and the website SDK.
 */
export async function generateRoomChatReply(input: {
  roomName: string
  message: string
  sessionId: string
  /** Appended to the agent's system prompt (e.g. an offer's sales brief). */
  extraInstruction?: string
  /** Token the model may emit as a signal; stripped from the reply and stored history. */
  marker?: string
  /** The Chat AI assistant picked in Services (its prompt replaces the room agent's). */
  persona?: { name: string; systemPrompt: string | null; firstMessage: string | null } | null
  /** The project an offer chat is about: its approved answers come first. */
  projectId?: string | null
}): Promise<ChatReplyResult> {
  const { roomName, message, sessionId, extraInstruction, marker, persona, projectId } = input

  const agent = await prismaClient.liveKitAgent.findUnique({ where: { roomName } })
  if (!agent) return { ok: false, status: 404, error: 'Agent not found' }

  const channels = await prismaClient.messageChannel.findMany({
    where: { roomName },
    orderBy: { updatedAt: 'desc' },
  })
  const ownerUserId = await resolveRoomOwnerUserId(agent.id, roomName)

  // Website chat keeps its history on a per-room WEB channel (created on first message).
  const channel =
    channels.find((c) => c.platform === Platform.WEB) ??
    (await prismaClient.messageChannel.upsert({
      where: { roomName_platform: { roomName, platform: Platform.WEB } },
      create: { roomName, platform: Platform.WEB, status: ChannelStatus.ACTIVE, userId: ownerUserId, accountLabel: 'Website' },
      update: {},
    }))
  const ownerVoiceCred = ownerUserId ? await getUserVoiceCredentialByUserId(ownerUserId) : null
  // The agent owner's own key only — never the platform's GOOGLE_API_KEY.
  const googleApiKey = safeDecrypt(ownerVoiceCred?.googleApiKey) || null

  const agentContext = await buildAgentContext(roomName, { persona, projectId })

  const conversation = await prismaClient.messageConversation.findFirst({
    where: { channelId: channel.id, externalId: sessionId },
  })
  const history: StoredMessage[] = Array.isArray(conversation?.messages)
    ? (conversation.messages as StoredMessage[])
    : []

  const result = await generateReply({
    userMessage: message,
    history: history.slice(-HISTORY_LIMIT),
    systemPrompt: extraInstruction
      ? `${agentContext.systemInstruction}\n\n${extraInstruction}`
      : agentContext.systemInstruction,
    llmModel: agent.llmModel || undefined,
    apiKey: googleApiKey,
    accountUserId: ownerUserId,
    usageSurface: 'messages',
  })
  if (!result.ok) return { ok: false, status: 502, error: result.error, code: result.code }

  const markerFound = !!marker && result.text.includes(marker)
  const replyText = marker ? result.text.split(marker).join('').trim() : result.text

  const now = new Date().toISOString()
  // Re-read before saving: the creator may have replied from the pipeline while the model ran.
  const latest = await prismaClient.messageConversation.findFirst({
    where: { channelId: channel.id, externalId: sessionId },
    select: { messages: true },
  })
  const latestHistory: StoredMessage[] = Array.isArray(latest?.messages) ? (latest.messages as StoredMessage[]) : history
  const updatedHistory: StoredMessage[] = [
    ...latestHistory,
    { role: 'user' as const, content: message, timestamp: now },
    { role: 'assistant' as const, content: replyText, timestamp: now },
  ].slice(-HISTORY_LIMIT)
  await prismaClient.messageConversation.upsert({
    where: { channelId_externalId: { channelId: channel.id, externalId: sessionId } },
    create: { channelId: channel.id, externalId: sessionId, platform: channel.platform, messages: updatedHistory },
    update: { messages: updatedHistory },
  })

  return {
    ok: true,
    reply: replyText,
    markerFound,
    roomJoinLink: agentContext.roomJoinLink,
    buyNowLink: agentContext.buyNowLink,
    voiceAgentLinks: agentContext.voiceAgentLinks,
    productLinks: agentContext.productLinks,
    socialAccounts: agentContext.socialAccounts,
  }
}
