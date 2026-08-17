import { NextRequest, NextResponse } from 'next/server'
import { prismaClient } from '@/lib/prismaClient'
import { decryptToken } from '@/lib/messages/encrypt'
import { generateReply } from '@/lib/messages/geminiText'
import { buildAgentContext } from '@/lib/messages/buildAgentContext'
import { resolveRoomOwnerUserId } from '@/lib/messages/resolveRoomOwnerUserId'
import { DEFAULT_LLM_MODEL } from '@/lib/llm/defaultModel'
import { Platform } from '@prisma/client'

type StoredMessage = {
  role: 'user' | 'assistant' | 'error'
  content: string
  timestamp?: string
  errorCode?: string
}

type TelegramUpdate = {
  message?: {
    chat?: { id?: number | string }
    text?: string
  }
}

async function sendTelegram(
  token: string,
  chatId: string | number,
  text: string,
  tag: string,
): Promise<{ sent: boolean; error?: string }> {
  if (!text || text.trim().length === 0) {
    console.error(`[${tag}] SEND SKIPPED: empty text`)
    return { sent: false, error: 'Empty message text' }
  }

  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })

    const body = await resp.text()

    if (!resp.ok) {
      console.error(`[${tag}] SEND FAILED: HTTP ${resp.status} — ${body}`)
      return { sent: false, error: `HTTP ${resp.status}: ${body}` }
    }

    console.log(`[${tag}] SEND OK: message delivered to chat ${chatId}`)
    return { sent: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[${tag}] SEND NETWORK ERROR: ${msg}`)
    return { sent: false, error: msg }
  }
}

async function upsertConversation(
  channelId: string,
  externalId: string,
  messages: StoredMessage[],
) {
  await prismaClient.messageConversation.upsert({
    where: {
      channelId_externalId: { channelId, externalId },
    },
    update: { messages },
    create: {
      channelId,
      externalId,
      platform: Platform.TELEGRAM,
      messages,
    },
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomName: string }> },
): Promise<NextResponse> {
  const { roomName } = await params
  const tag = `telegram/${roomName}`

  let update: TelegramUpdate
  try {
    update = (await req.json()) as unknown as TelegramUpdate
  } catch {
    console.error(`[${tag}] Failed to parse request body`)
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const message = update.message
  if (!message || !message.chat || !message.text) {
    console.log(`[${tag}] Skipped: no message/chat/text in update`)
    return NextResponse.json({ ok: true })
  }

  const chatId = message.chat.id
  if (chatId === undefined || chatId === null) {
    return NextResponse.json({ ok: true })
  }
  const text = String(message.text)
  console.log(`[${tag}] Incoming from chat ${chatId}: "${text.substring(0, 80)}"`)

  const agent = await prismaClient.liveKitAgent.findUnique({
    where: { roomName },
  })

  if (!agent) {
    console.error(`[${tag}] ABORT: No LiveKitAgent found for room`)
    return NextResponse.json({ ok: true })
  }

  const channel = await prismaClient.messageChannel.findUnique({
    where: {
      roomName_platform: { roomName, platform: Platform.TELEGRAM },
    },
  })

  if (!channel || !channel.telegramBotToken) {
    console.error(`[${tag}] ABORT: No Telegram channel or missing bot token`)
    return NextResponse.json({ ok: true })
  }

  let token: string | null = null
  try {
    token = decryptToken(channel.telegramBotToken)
  } catch (err) {
    console.error(`[${tag}] ABORT: Decryption failed:`, err)
  }

  if (!token) {
    console.error(`[${tag}] ABORT: Could not decrypt bot token`)
    return NextResponse.json({ ok: true })
  }

  console.log(`[${tag}] Token decrypted OK, agent: ${agent.name}`)

  if (text.startsWith('/start') || (text.startsWith('/') && text.length <= 64)) {
    const res = await sendTelegram(
      token,
      chatId,
      `Hi! You're connected to ${agent.name}. Send me a message and I'll reply here.`,
      tag,
    )
    console.log(`[${tag}] /start reply sent:`, res.sent)
    return NextResponse.json({ ok: true })
  }

  const externalId = String(chatId)

  const existing = await prismaClient.messageConversation.findFirst({
    where: { channelId: channel.id, externalId },
  })

  const rawMessages = existing?.messages as unknown
  const history: StoredMessage[] = Array.isArray(rawMessages) ? (rawMessages as StoredMessage[]) : []
  const limitedHistory = history.slice(-50)

  const userMsg: StoredMessage = {
    role: 'user',
    content: text,
    timestamp: new Date().toISOString(),
  }

  const messagesWithUser = [...limitedHistory, userMsg]
  await upsertConversation(channel.id, externalId, messagesWithUser)
  console.log(`[${tag}] User message saved to DB`)

  const cleanHistory = limitedHistory.filter((m) => m.role !== 'error')

  const context = await buildAgentContext(roomName)
  const ownerUserId = await resolveRoomOwnerUserId(agent.id, roomName)

  console.log(`[${tag}] Calling Gemini (model: ${agent.llmModel || DEFAULT_LLM_MODEL}, history: ${cleanHistory.length} msgs)...`)
  const startTime = Date.now()

  const result = await generateReply({
    userMessage: text,
    history: cleanHistory.map((m) => ({
      role: m.role === 'error' ? 'assistant' : m.role,
      content: m.content,
    })),
    systemPrompt: context.systemInstruction,
    llmModel: agent.llmModel || undefined,
    accountUserId: ownerUserId,
    usageSurface: 'messages',
  })

  const elapsed = Date.now() - startTime

  if (!result.ok) {
    console.error(`[${tag}] GEMINI FAILED in ${elapsed}ms [${result.code}]: ${result.error}`)

    const errorMsg: StoredMessage = {
      role: 'error',
      content: result.error,
      timestamp: new Date().toISOString(),
      errorCode: result.code,
    }

    await upsertConversation(channel.id, externalId, [...messagesWithUser, errorMsg])

    let userFacingError = 'Sorry, I ran into a problem generating a reply.'
    switch (result.code) {
      case 'NO_API_KEY':
        userFacingError = 'The AI service is not configured. The owner needs to add their Google API key.'
        break
      case 'INVALID_API_KEY':
        userFacingError = 'The AI service key is invalid. The owner needs to check their Google API key.'
        break
      case 'QUOTA_EXCEEDED':
        userFacingError = 'The AI service is temporarily at capacity. Please try again in a few minutes.'
        break
      case 'MODEL_ERROR':
        userFacingError = 'The AI model configured for this agent is unavailable. Please contact the owner.'
        break
    }

    const sendResult = await sendTelegram(token, chatId, userFacingError, tag)
    console.log(`[${tag}] Error reply to Telegram:`, sendResult.sent ? 'OK' : sendResult.error)
    return NextResponse.json({ ok: true })
  }

  console.log(`[${tag}] GEMINI OK in ${elapsed}ms, reply length: ${result.text.length} chars`)

  const assistantMsg: StoredMessage = {
    role: 'assistant',
    content: result.text,
    timestamp: new Date().toISOString(),
  }

  await upsertConversation(channel.id, externalId, [...messagesWithUser, assistantMsg])
  console.log(`[${tag}] Assistant message saved to DB`)

  const sendResult = await sendTelegram(token, chatId, result.text, tag)
  console.log(`[${tag}] Reply to Telegram:`, sendResult.sent ? 'OK' : `FAILED: ${sendResult.error}`)

  return NextResponse.json({ ok: true })
}
