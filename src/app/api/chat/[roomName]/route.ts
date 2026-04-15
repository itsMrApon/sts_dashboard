import { NextResponse } from 'next/server'
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
}

function safeDecrypt(value: string | null | undefined): string | null {
  try {
    return decryptToken(value)
  } catch {
    return null
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomName: string }> },
) {
  try {
    const { roomName } = await params
    const body = await req.json()
    const message = typeof body?.message === 'string' ? body.message : ''
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : ''

    if (!message || !sessionId) {
      return NextResponse.json(
        { error: 'message and sessionId required' },
        { status: 400 },
      )
    }

    const agent = await prismaClient.liveKitAgent.findUnique({
      where: { roomName },
    })
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
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

    const context = await buildAgentContext(roomName)

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
      systemPrompt: context.systemInstruction,
      llmModel: agent.llmModel || undefined,
      apiKey: googleApiKey,
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
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

    return NextResponse.json({
      reply: replyText,
      roomJoinLink: context.roomJoinLink,
      buyNowLink: context.buyNowLink,
      voiceAgentLinks: context.voiceAgentLinks,
      productLinks: context.productLinks,
      socialAccounts: context.socialAccounts,
    })
  } catch (error) {
    console.error('[web-chat]', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 },
    )
  }
}
