import { NextRequest, NextResponse } from 'next/server'
import nacl from 'tweetnacl'
import { prismaClient } from '@/lib/prismaClient'
import { decryptToken } from '@/lib/messages/encrypt'
import { generateReply } from '@/lib/messages/geminiText'
import { buildAgentContext } from '@/lib/messages/buildAgentContext'
import { resolveRoomOwnerUserId } from '@/lib/messages/resolveRoomOwnerUserId'
import { Platform } from '@prisma/client'

type StoredMessage = {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

function verifySignature(req: NextRequest, publicKey: string, body: string): boolean {
  const signature = req.headers.get('x-signature-ed25519')
  const timestamp = req.headers.get('x-signature-timestamp')

  if (!signature || !timestamp) return false

  try {
    const sig = Buffer.from(signature, 'hex')
    const ts = Buffer.from(timestamp, 'utf8')
    const pk = Buffer.from(publicKey, 'hex')
    const msg = Buffer.concat([ts, Buffer.from(body, 'utf8')])

    return nacl.sign.detached.verify(msg, sig, pk)
  } catch {
    return false
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomName: string }> },
): Promise<NextResponse> {
  const { roomName } = await params
  const rawBody = await req.text()

  const channel = await prismaClient.messageChannel.findUnique({
    where: {
      roomName_platform: {
        roomName,
        platform: Platform.DISCORD,
      },
    },
  })

  const publicKey = channel?.discordPublicKey
  if (!publicKey) {
    return NextResponse.json({ error: 'Unknown application' }, { status: 401 })
  }

  const isValid = verifySignature(req, publicKey, rawBody)
  if (!isValid) {
    return NextResponse.json({ error: 'Bad signature' }, { status: 401 })
  }

  const interaction = JSON.parse(rawBody)

  // PING
  if (interaction.type === 1) {
    return NextResponse.json({ type: 1 })
  }

  const agent = await prismaClient.liveKitAgent.findUnique({
    where: { roomName },
  })

  if (!agent || !channel || !channel.discordBotToken) {
    return NextResponse.json({ type: 4, data: { content: 'Agent not configured.' } })
  }

  const token = decryptToken(channel.discordBotToken)
  if (!token) {
    return NextResponse.json({ type: 4, data: { content: 'Agent token missing.' } })
  }

  const userMessage: string =
    interaction.type === 2
      ? interaction.data?.options?.[0]?.value ?? ''
      : interaction.data?.content ?? ''

  if (!userMessage) {
    return NextResponse.json({
      type: 4,
      data: { content: 'Send a message with content to talk to this agent.' },
    })
  }

  const externalId = String(interaction.channel_id || interaction.user?.id || 'unknown')

  const existing = await prismaClient.messageConversation.findFirst({
    where: {
      channelId: channel.id,
      externalId,
    },
  })

  const rawMessages = existing?.messages as unknown
  const history: StoredMessage[] = Array.isArray(rawMessages) ? (rawMessages as StoredMessage[]) : []
  const limitedHistory = history.slice(-50)

  const context = await buildAgentContext(roomName)
  const ownerUserId = await resolveRoomOwnerUserId(agent.id, roomName)

  const result = await generateReply({
    userMessage,
    history: limitedHistory,
    systemPrompt: context.systemInstruction,
    llmModel: agent.llmModel || undefined,
    accountUserId: ownerUserId,
    usageSurface: 'messages',
  })
  const replyText = result.ok
    ? result.text
    : 'Sorry, I ran into a problem. Please try again.'

  const newMessages = [
    ...limitedHistory,
    {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    },
    {
      role: 'assistant',
      content: replyText,
      timestamp: new Date().toISOString(),
    },
  ]

  await prismaClient.messageConversation.upsert({
    where: {
      channelId_externalId: {
        channelId: channel.id,
        externalId,
      },
    },
    update: {
      messages: newMessages,
    },
    create: {
      channelId: channel.id,
      externalId,
      platform: Platform.DISCORD,
      messages: newMessages,
    },
  })

  return NextResponse.json({
    type: 4,
    data: {
      content: replyText,
    },
  })
}

