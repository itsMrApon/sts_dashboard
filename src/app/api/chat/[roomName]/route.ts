import { NextResponse } from 'next/server'
import { prismaClient } from '@/lib/prismaClient'
import { generateReply } from '@/lib/messages/geminiText'
import { buildAgentContext } from '@/lib/messages/buildAgentContext'
import { getUserVoiceCredentialByUserId } from '@/lib/voiceCredentialsRepo'
import { decryptToken } from '@/lib/messages/encrypt'
import { resolveRoomOwnerUserId } from '@/lib/messages/resolveRoomOwnerUserId'
import { EMBED_RATE_LIMITS, checkRateLimit } from '@/lib/embed/rateLimit'
import {
  clientIp,
  embedOptions,
  guardEmbedRequest,
  jsonWithCors,
} from '@/lib/embed/embedRouteGuard'

type StoredMessage = {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

function safeDecrypt(value: string | null | undefined): string | null {
  try {
    return decryptToken(value)
  } catch {
    return null
  }
}

type RouteContext = { params: Promise<{ roomName: string }> }

export async function OPTIONS(req: Request, routeContext: RouteContext) {
  const { roomName } = await routeContext.params
  return embedOptions(req, roomName)
}

export async function POST(req: Request, routeContext: RouteContext) {
  try {
    const { roomName } = await routeContext.params
    const body = await req.json()
    const message = typeof body?.message === 'string' ? body.message : ''
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : ''

    if (!message || !sessionId) {
      return NextResponse.json(
        { error: 'message and sessionId required' },
        { status: 400 },
      )
    }

    const ip = clientIp(req)
    const guard = await guardEmbedRequest(req, roomName, {
      key: `embed:chat:${roomName}:${sessionId}`,
      limit: EMBED_RATE_LIMITS.chat.limit,
      windowMs: EMBED_RATE_LIMITS.chat.windowMs,
    })
    if (!guard.ok) return guard.response

    const ipGuard = checkRateLimitIp(roomName, ip, guard.corsHeaders)
    if (ipGuard) return ipGuard

    const agent = await prismaClient.liveKitAgent.findUnique({
      where: { roomName },
    })
    if (!agent) {
      return jsonWithCors({ error: 'Agent not found' }, guard.corsHeaders, { status: 404 })
    }

    const channels = await prismaClient.messageChannel.findMany({
      where: { roomName },
      orderBy: { updatedAt: 'desc' },
    })
    const channel =
      channels.find((c) => c.status === 'ACTIVE') ?? channels[0] ?? null

    const ownerUserId = await resolveRoomOwnerUserId(agent.id, roomName)

    const ownerVoiceCred = ownerUserId
      ? await getUserVoiceCredentialByUserId(ownerUserId)
      : null
    const googleApiKey =
      safeDecrypt(ownerVoiceCred?.googleApiKey) || process.env.GOOGLE_API_KEY || null

    const agentContext = await buildAgentContext(roomName)

    const conversation = channel
      ? await prismaClient.messageConversation.findFirst({
          where: { channelId: channel.id, externalId: sessionId },
        })
      : null

    const history: StoredMessage[] = Array.isArray(conversation?.messages)
      ? (conversation.messages as StoredMessage[])
      : []

    const result = await generateReply({
      userMessage: message,
      history: history.slice(-50),
      systemPrompt: agentContext.systemInstruction,
      llmModel: agent.llmModel || undefined,
      apiKey: googleApiKey,
      accountUserId: ownerUserId,
      usageSurface: 'messages',
    })

    if (!result.ok) {
      return jsonWithCors(
        { error: result.error, code: result.code },
        guard.corsHeaders,
        { status: 502 },
      )
    }

    const replyText = result.text

    if (channel) {
      const updatedHistory: StoredMessage[] = [
        ...history,
        { role: 'user' as const, content: message, timestamp: new Date().toISOString() },
        { role: 'assistant' as const, content: replyText, timestamp: new Date().toISOString() },
      ].slice(-50)

      await prismaClient.messageConversation.upsert({
        where: {
          channelId_externalId: { channelId: channel.id, externalId: sessionId },
        },
        create: {
          channelId: channel.id,
          externalId: sessionId,
          platform: channel.platform,
          messages: updatedHistory,
        },
        update: { messages: updatedHistory },
      })
    }

    return jsonWithCors(
      {
        reply: replyText,
        roomJoinLink: agentContext.roomJoinLink,
        buyNowLink: agentContext.buyNowLink,
        voiceAgentLinks: agentContext.voiceAgentLinks,
        productLinks: agentContext.productLinks,
        socialAccounts: agentContext.socialAccounts,
      },
      guard.corsHeaders,
    )
  } catch (error) {
    console.error('[web-chat]', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 },
    )
  }
}

function checkRateLimitIp(
  roomName: string,
  ip: string,
  corsHeaders: HeadersInit,
) {
  const rate = checkRateLimit(
    `embed:chat-ip:${roomName}:${ip}`,
    EMBED_RATE_LIMITS.chatIp.limit,
    EMBED_RATE_LIMITS.chatIp.windowMs,
  )
  if (!rate.ok) {
    return jsonWithCors(
      { error: 'Too many requests', code: 'RATE_LIMITED' },
      corsHeaders,
      {
        status: 429,
        headers: { 'Retry-After': String(rate.retryAfterSec) },
      },
    )
  }
  return null
}
