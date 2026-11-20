import 'server-only'
import { decryptToken } from '@/lib/messages/encrypt'
import { appendCreatorReply } from '@/lib/offers/offerPipeline'
import { prismaClient } from '@/lib/prismaClient'
import { parseAlertRef } from './telegramAlerts'
import { reactToTelegramMessage, sendTelegramMessage, type TelegramUpdate } from './telegramApi'

/**
 * What the creator's bot does with an update:
 * - `/start <code>` from a chat links that chat for alerts (the code comes from Integrations →
 *   Telegram, so only the creator can link a chat).
 * - A reply to an alert in the linked chat goes into that buyer's chat and pauses the AI.
 * Everything else is ignored.
 */

const START_RE = /^\/start(?:@\w+)?(?:\s+(\S+))?/i

function chatLabel(chat: { type: string; title?: string; first_name?: string }) {
  return (chat.title || chat.first_name || (chat.type === 'private' ? 'Private chat' : 'Group')).slice(0, 255)
}

export async function handleTelegramUpdate(webhookSecret: string, update: TelegramUpdate): Promise<void> {
  const connection = await prismaClient.telegramConnection.findUnique({
    where: { webhookSecret },
    select: { workspaceId: true, userId: true, botTokenEnc: true, linkCode: true, chatId: true, enabled: true },
  })
  if (!connection?.enabled) return
  const token = decryptToken(connection.botTokenEnc)
  const message = update.message
  if (!token || !message?.text || message.from?.is_bot) return

  const chatId = String(message.chat.id)
  const start = message.text.match(START_RE)
  if (start) {
    if (start[1] && start[1] === connection.linkCode) {
      await prismaClient.telegramConnection.update({
        where: { workspaceId: connection.workspaceId },
        data: { chatId, chatTitle: chatLabel(message.chat), linkedAt: new Date() },
      })
      await sendTelegramMessage(
        token,
        chatId,
        'Connected. New buyer chats will show up here. Reply to an alert to answer the buyer.',
      )
    } else if (chatId !== connection.chatId) {
      await sendTelegramMessage(token, chatId, 'To link this chat, use the link in Integrations → Telegram.')
    }
    return
  }

  // Replies only count in the linked chat, and only to one of this bot's alerts.
  if (chatId !== connection.chatId) return
  const ref = message.reply_to_message?.from?.is_bot ? parseAlertRef(message.reply_to_message.text) : null
  if (!ref) return

  const result = await appendCreatorReply(ref.webinarId, connection.userId, ref.contactId, message.text)
  if (result.ok) {
    const reacted = await reactToTelegramMessage(token, chatId, message.message_id)
    if (!reacted.ok) await sendTelegramMessage(token, chatId, 'Sent.', { replyToMessageId: message.message_id })
  } else {
    await sendTelegramMessage(token, chatId, `Not sent: ${result.error}`, { replyToMessageId: message.message_id })
  }
}
