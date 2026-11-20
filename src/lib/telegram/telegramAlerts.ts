import 'server-only'
import { decryptToken } from '@/lib/messages/encrypt'
import { prismaClient } from '@/lib/prismaClient'
import { sendTelegramMessage } from './telegramApi'

/**
 * Buyer-chat alerts to the creator's Telegram. Each alert ends with a ref line; replying to the
 * alert in Telegram posts the reply into that buyer's chat (see telegramWebhook.ts).
 */

export type OfferChatAlertReason = 'new' | 'waiting' | 'ready'

const HEADLINE: Record<OfferChatAlertReason, string> = {
  new: '💬 New chat',
  waiting: '🙋 Waiting for you',
  ready: '🔥 Ready to buy',
}

const REF_RE = /#ref o:([0-9a-f-]{36}):([0-9a-f-]{36})/i

export function alertRef(webinarId: string, contactId: string) {
  return `#ref o:${webinarId}:${contactId}`
}

/** The offer and buyer an alert was about, read from its ref line. */
export function parseAlertRef(text: string | undefined): { webinarId: string; contactId: string } | null {
  const match = text?.match(REF_RE)
  return match ? { webinarId: match[1].toLowerCase(), contactId: match[2].toLowerCase() } : null
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
}

/** The linked bot and chat for a creator, or null when Telegram is off or not linked yet. */
export async function linkedTelegram(userId: string) {
  const connection = await prismaClient.telegramConnection.findFirst({
    where: { userId, enabled: true, chatId: { not: null } },
    select: { botTokenEnc: true, chatId: true },
  })
  const token = decryptToken(connection?.botTokenEnc)
  return token && connection?.chatId ? { token, chatId: connection.chatId } : null
}

/**
 * Tells the creator's Telegram about a buyer message. Never throws: an alert that cannot be sent
 * must not break the buyer's chat.
 */
export async function sendOfferChatAlert(input: {
  creatorUserId: string
  webinarId: string
  offerTitle: string
  contactId: string
  message: string
  reason: OfferChatAlertReason
}) {
  try {
    const telegram = await linkedTelegram(input.creatorUserId)
    if (!telegram) return
    const contact = await prismaClient.contact.findFirst({
      where: { id: input.contactId, userId: input.creatorUserId },
      select: { name: true, email: true, phone: true },
    })
    const who = [contact?.name, contact?.email, contact?.phone].filter(Boolean).join(' · ') || 'A visitor'
    const footer =
      input.reason === 'ready'
        ? 'The AI showed them the order button.'
        : 'Reply to this message to answer them here. The AI waits while you talk.'
    const text = [
      `${HEADLINE[input.reason]} · ${input.offerTitle}`,
      who,
      '',
      input.message.slice(0, 1500),
      '',
      footer,
      alertRef(input.webinarId, input.contactId),
    ].join('\n')

    const pipelineUrl = `${appUrl()}/projects/${input.webinarId}/pipeline`
    const result = await sendTelegramMessage(telegram.token, telegram.chatId, text, {
      // Telegram only accepts public https links on buttons.
      buttonUrl: pipelineUrl.startsWith('https://') ? { label: 'Open the chat', url: pipelineUrl } : undefined,
    })
    if (!result.ok) console.warn('[telegram-alert]', result.error)
  } catch (error) {
    console.warn('[telegram-alert]', error instanceof Error ? error.message : error)
  }
}
