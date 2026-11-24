import { prismaClient } from '@/lib/prismaClient'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'
import { generateRoomChatReply } from '@/lib/services/chatReply'
import { chatStyleInstruction } from '@/lib/services/persona'
import { getBusinessServices } from '@/lib/services/serviceConfig'
import { claimDelivery, type ResolvedConnection } from '@/lib/whatsapp/connection'
import { sendText } from '@/lib/whatsapp/kapso'

/** One customer message as Kapso sends it (payload v2). Fields may be missing; read defensively. */
type KapsoMessageEvent = {
  message?: {
    id?: string
    type?: string
    from?: string
    from_user_id?: string
    text?: { body?: string }
    kapso?: { direction?: string; content?: string }
  }
  conversation?: { id?: string; phone_number?: string; contact_name?: string }
  phone_number_id?: string
}

const WHATSAPP_STYLE =
  'You are replying on WhatsApp. Write plain text (no markdown, no headings), short paragraphs, and paste links as plain URLs.'

/** Single event or a buffered batch ({ batch: true, data: [...] }). */
export function eventsFromBody(body: unknown): KapsoMessageEvent[] {
  if (!body || typeof body !== 'object') return []
  const record = body as { batch?: unknown; data?: unknown }
  if (record.batch === true && Array.isArray(record.data)) return record.data as KapsoMessageEvent[]
  return [body as KapsoMessageEvent]
}

/**
 * Answers one inbound WhatsApp text with the creator's Chat AI assistant and sends the reply
 * back through their Kapso number. Skipped when the creator took the chat over in the pipeline,
 * when AI replies are off, or when this message was already handled (Kapso retries).
 */
export async function handleInboundMessage(connection: ResolvedConnection, event: KapsoMessageEvent, deliveryKey: string | null) {
  const message = event.message
  if (!message?.id || message.kapso?.direction === 'outbound') return
  if (event.phone_number_id && event.phone_number_id !== connection.phoneNumberId) return

  // Dedupe on the message id, which stays the same across Kapso's retries of one message.
  if (!(await claimDelivery(`whatsapp:${message.id}`, 'whatsapp'))) {
    if (deliveryKey) console.info('[whatsapp] retry already handled', deliveryKey)
    return
  }

  await prismaClient.whatsAppConnection.update({ where: { id: connection.id }, data: { lastInboundAt: new Date() } })

  const text = (message.type === 'text' ? message.text?.body : message.kapso?.content)?.trim()
  if (!text) return
  const phone = message.from || event.conversation?.phone_number || null
  const senderKey = phone || message.from_user_id
  if (!senderKey) return

  const business = await getCreatorBusiness(connection.userId)
  if (!business) return
  const sessionId = `whatsapp:${senderKey}`.slice(0, 128)

  // The creator pressed Take over in the pipeline: the AI stays quiet in this chat.
  const paused = await prismaClient.messageConversation.findFirst({
    where: { externalId: sessionId, channel: { roomName: business.roomName }, aiPausedAt: { not: null } },
    select: { id: true },
  })
  if (paused || !connection.aiReplies) return

  const { chat } = await getBusinessServices(business.workspaceId)
  const result = await generateRoomChatReply({
    roomName: business.roomName,
    message: text,
    sessionId,
    extraInstruction: `${chatStyleInstruction(chat.config)}\n${WHATSAPP_STYLE}`,
    persona: chat.agent,
  })
  if (!result.ok) {
    console.warn('[whatsapp] no reply generated', result.status, result.error)
    return
  }
  await sendText({
    apiKey: connection.apiKey,
    phoneNumberId: connection.phoneNumberId,
    to: { phone, userId: message.from_user_id },
    body: result.reply,
    replyTo: message.id,
  })
}
