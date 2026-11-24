/**
 * The few Kapso calls sts-ai needs, over plain fetch. Kapso proxies Meta's WhatsApp Cloud API,
 * so requests and responses use Meta's shape; switching a creator to Meta direct later means
 * changing the base URL and the auth header only.
 */

const KAPSO_META_BASE = 'https://api.kapso.ai/meta/whatsapp/v24.0'
const TIMEOUT_MS = 15_000

export class KapsoError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'KapsoError'
  }
}

async function kapsoFetch<T>(apiKey: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${KAPSO_META_BASE}${path}`, {
    ...init,
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } | string }
  if (!res.ok) {
    const detail = typeof body.error === 'string' ? body.error : body.error?.message
    throw new KapsoError(detail || `Kapso answered ${res.status}`, res.status)
  }
  return body
}

/** The number's details, used to test a connection and show which number it is. */
export async function getPhoneNumber(apiKey: string, phoneNumberId: string) {
  return kapsoFetch<{ id?: string; display_phone_number?: string; verified_name?: string }>(
    apiKey,
    `/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name`,
  )
}

/**
 * Sends a text reply. `to` is a phone number (digits) or, when WhatsApp hides it, the sender's
 * business-scoped user id. Only works inside the 24-hour window after the customer wrote.
 */
export async function sendText(input: {
  apiKey: string
  phoneNumberId: string
  to: { phone?: string | null; userId?: string | null }
  body: string
  replyTo?: string | null
}) {
  const recipient = input.to.phone ? { to: input.to.phone } : input.to.userId ? { recipient: input.to.userId } : null
  if (!recipient) throw new KapsoError('No recipient for the reply', 400)
  return kapsoFetch<{ messages?: { id: string }[] }>(input.apiKey, `/${encodeURIComponent(input.phoneNumberId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      ...recipient,
      type: 'text',
      // WhatsApp's limit is 4096 characters.
      text: { body: input.body.slice(0, 4000) },
      ...(input.replyTo ? { context: { message_id: input.replyTo } } : {}),
    }),
  })
}
