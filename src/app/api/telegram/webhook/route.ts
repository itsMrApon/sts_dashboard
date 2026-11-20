import { NextResponse } from 'next/server'
import type { TelegramUpdate } from '@/lib/telegram/telegramApi'
import { handleTelegramUpdate } from '@/lib/telegram/telegramWebhook'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SECRET_RE = /^[A-Za-z0-9_-]{32,64}$/

/**
 * Webhook for creators' Telegram bots. Telegram sends the secret we gave it in setWebhook in
 * X-Telegram-Bot-Api-Secret-Token; that secret picks the creator's connection.
 * Always answers 200 for a known shape, so Telegram does not keep retrying a message we chose to skip.
 */
export async function POST(request: Request) {
  const secret = request.headers.get('x-telegram-bot-api-secret-token') ?? ''
  if (!SECRET_RE.test(secret)) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null
  if (!update || typeof update.update_id !== 'number') return NextResponse.json({ ok: true })

  try {
    await handleTelegramUpdate(secret, update)
  } catch (error) {
    console.error('[telegram-webhook]', error instanceof Error ? error.message : error)
  }
  return NextResponse.json({ ok: true })
}
