import { after, NextResponse } from 'next/server'
import { handleComment, handleDirectMessage, processInstagramQueue, verifyMetaSignature } from '@/lib/instagram/campaigns'

export const runtime = 'nodejs'

/** Meta's webhook check when the URL is saved in the app dashboard. */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const verifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN
  if (url.searchParams.get('hub.mode') === 'subscribe' && verifyToken && url.searchParams.get('hub.verify_token') === verifyToken) {
    return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 })
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

type Entry = {
  id?: string
  changes?: { field?: string; value?: Record<string, unknown> }[]
  messaging?: { sender?: { id?: string }; message?: { text?: string; is_echo?: boolean } }[]
}

/** Comments and DMs for every connected creator. Answers at once; sends in the background. */
export async function POST(req: Request) {
  const rawBody = await req.text()
  if (!verifyMetaSignature(rawBody, req.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'Bad signature' }, { status: 401 })
  }
  let body: { object?: string; entry?: Entry[] }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 })
  }
  if (body.object !== 'instagram') return NextResponse.json({ ok: true })

  after(async () => {
    let queued = 0
    for (const entry of body.entry ?? []) {
      if (!entry.id) continue
      for (const change of entry.changes ?? []) {
        if (change.field === 'comments' && change.value) {
          queued += await handleComment(entry.id, change.value as Parameters<typeof handleComment>[1]).catch((error) => {
            console.error('[instagram] comment failed', error)
            return 0
          })
        }
      }
      for (const event of entry.messaging ?? []) {
        const text = event.message?.text
        if (!text || event.message?.is_echo || !event.sender?.id) continue
        await handleDirectMessage(entry.id, event.sender.id, text).catch((error) => console.error('[instagram] dm failed', error))
      }
    }
    if (queued > 0) await processInstagramQueue().catch((error) => console.error('[instagram] queue failed', error))
  })
  return NextResponse.json({ ok: true })
}
