/**
 * A small client for the Telegram Bot API (https://core.telegram.org/bots/api), on the creator's
 * own bot token. Every call has a timeout and returns a result instead of throwing.
 */

const TELEGRAM_TIMEOUT_MS = 8000

export type TelegramResult<T> = { ok: true; result: T } | { ok: false; error: string }

export type TelegramChat = { id: number; type: 'private' | 'group' | 'supergroup' | 'channel'; title?: string; first_name?: string }

export type TelegramMessage = {
  message_id: number
  chat: TelegramChat
  from?: { id: number; is_bot: boolean; first_name?: string; username?: string }
  text?: string
  reply_to_message?: TelegramMessage
}

export type TelegramUpdate = { update_id: number; message?: TelegramMessage }

async function call<T>(token: string, method: string, body?: Record<string, unknown>): Promise<TelegramResult<T>> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
      cache: 'no-store',
    })
    const payload = (await response.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null
    if (!payload?.ok) return { ok: false, error: payload?.description || `Telegram error ${response.status}` }
    return { ok: true, result: payload.result as T }
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError'
    return { ok: false, error: timedOut ? 'Telegram did not answer in time' : 'Could not reach Telegram' }
  }
}

/** Bot tokens look like 123456789:AA... */
export const TELEGRAM_TOKEN_RE = /^\d{5,15}:[A-Za-z0-9_-]{30,60}$/

export function getBotInfo(token: string) {
  return call<{ id: number; username: string; first_name: string }>(token, 'getMe')
}

export function setBotWebhook(token: string, url: string, secretToken: string) {
  return call<boolean>(token, 'setWebhook', {
    url,
    secret_token: secretToken,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  })
}

export function deleteBotWebhook(token: string) {
  return call<boolean>(token, 'deleteWebhook', { drop_pending_updates: true })
}

export function sendTelegramMessage(
  token: string,
  chatId: string | number,
  text: string,
  options: { replyToMessageId?: number; buttonUrl?: { label: string; url: string } } = {},
) {
  return call<TelegramMessage>(token, 'sendMessage', {
    chat_id: chatId,
    // Plain text: buyer messages are shown exactly as typed (Bangla and emoji included).
    text: text.slice(0, 4000),
    link_preview_options: { is_disabled: true },
    ...(options.replyToMessageId
      ? { reply_parameters: { message_id: options.replyToMessageId, allow_sending_without_reply: true } }
      : {}),
    ...(options.buttonUrl
      ? { reply_markup: { inline_keyboard: [[{ text: options.buttonUrl.label, url: options.buttonUrl.url }]] } }
      : {}),
  })
}

/** A small 👍 on the creator's message once their reply has reached the buyer. */
export function reactToTelegramMessage(token: string, chatId: string | number, messageId: number, emoji = '👍') {
  return call<boolean>(token, 'setMessageReaction', {
    chat_id: chatId,
    message_id: messageId,
    reaction: [{ type: 'emoji', emoji }],
  })
}
