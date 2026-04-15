import { NextResponse } from 'next/server'
import { prismaClient } from '@/lib/prismaClient'
import { generateReply } from '@/lib/messages/geminiText'
import { decryptToken } from '@/lib/messages/encrypt'
import { buildAgentContext } from '@/lib/messages/buildAgentContext'
import { Platform } from '@prisma/client'

type StoredMessage = {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomName: string }> },
) {
  try {
    const { roomName } = await params
    const body = await req.json()

    if (body.type === 'url_verification') {
      return NextResponse.json({ challenge: body.challenge })
    }

    if (body.event?.bot_id || body.event?.type !== 'message') {
      return NextResponse.json({ ok: true })
    }

    const text = body.event?.text as string | undefined
    const userId = body.event?.user as string | undefined
    const channelId = body.event?.channel as string | undefined

    if (!text || !userId || !channelId) {
      return NextResponse.json({ ok: true })
    }

    const [agent, channel] = await Promise.all([
      prismaClient.liveKitAgent.findUnique({ where: { roomName } }),
      prismaClient.messageChannel.findUnique({
        where: { roomName_platform: { roomName, platform: Platform.SLACK } },
      }),
    ])

    if (!agent || !channel?.slackBotToken) {
      return NextResponse.json({ ok: true })
    }

    const botToken = decryptToken(channel.slackBotToken)
    if (!botToken) return NextResponse.json({ ok: true })

    const externalId = `${userId}-${channelId}`

    const conversation = await prismaClient.messageConversation.findUnique({
      where: { channelId_externalId: { channelId: channel.id, externalId } },
    })

    const history: StoredMessage[] = Array.isArray(conversation?.messages)
      ? (conversation.messages as StoredMessage[])
      : []

    const context = await buildAgentContext(roomName)

    const result = await generateReply({
      userMessage: text,
      history: history.slice(-50),
      systemPrompt: context.systemInstruction,
      llmModel: agent.llmModel || undefined,
    })

    const replyText = result.ok ? result.text : 'Sorry, I ran into a problem. Please try again.'

    const updatedHistory: StoredMessage[] = [
      ...history,
      { role: 'user', content: text, timestamp: new Date().toISOString() },
      { role: 'assistant', content: replyText, timestamp: new Date().toISOString() },
    ].slice(-50)

    await prismaClient.messageConversation.upsert({
      where: { channelId_externalId: { channelId: channel.id, externalId } },
      create: {
        channelId: channel.id,
        externalId,
        platform: Platform.SLACK,
        messages: updatedHistory,
      },
      update: { messages: updatedHistory },
    })

    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${botToken}`,
      },
      body: JSON.stringify({ channel: channelId, text: replyText }),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[slack-webhook]', error)
    return NextResponse.json({ ok: true })
  }
}
