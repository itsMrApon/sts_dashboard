import { after, NextResponse } from 'next/server'
import { findConnectionByToken, verifyKapsoSignature } from '@/lib/whatsapp/connection'
import { eventsFromBody, handleInboundMessage } from '@/lib/whatsapp/inbound'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ token: string }> }

/**
 * Kapso → sts-ai, one address per creator (Integrations → WhatsApp shows it). Checks the
 * signature, answers 200 at once (Kapso retries anything slower than 10 s), then replies to the
 * customer in the background.
 */
export async function POST(req: Request, routeContext: RouteContext) {
  const { token } = await routeContext.params
  const connection = await findConnectionByToken(token)
  if (!connection) return NextResponse.json({ error: 'Unknown webhook' }, { status: 404 })

  const rawBody = await req.text()
  if (!verifyKapsoSignature(rawBody, req.headers.get('x-webhook-signature'), connection.webhookSecret)) {
    return NextResponse.json({ error: 'Bad signature' }, { status: 401 })
  }

  const event = req.headers.get('x-webhook-event')
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 })
  }
  const eventName = event ?? (body as { type?: string } | null)?.type ?? null
  if (eventName !== 'whatsapp.message.received') return NextResponse.json({ ok: true, ignored: eventName })

  const deliveryKey = req.headers.get('x-idempotency-key')
  after(async () => {
    for (const item of eventsFromBody(body)) {
      try {
        await handleInboundMessage(connection, item, deliveryKey)
      } catch (error) {
        console.error('[whatsapp] inbound failed', error)
      }
    }
  })
  return NextResponse.json({ ok: true })
}
