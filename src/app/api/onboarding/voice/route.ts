import { NextResponse } from 'next/server'
import { onAuthenticateUser } from '@/actions/auth'
import { resolveUserProviderKey } from '@/lib/credentials/providerKeys'
import { checkRateLimit } from '@/lib/embed/rateLimit'
import { guideLine, isGuideLineId } from '@/lib/onboarding/guideLines'
import { GUIDE_VOICE } from '@/lib/onboarding/setupGuide'
import { synthesizeWithCartesia } from '@/lib/voices/cartesiaSpeech'

const RATE_LIMIT = { limit: 40, windowMs: 60_000 }

/**
 * The setup wizard's voice for one card. Only the fixed setup lines can be spoken (names filled
 * in), on the creator's own Cartesia key.
 */
export async function POST(request: Request) {
  const auth = await onAuthenticateUser()
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { line?: unknown; name?: unknown; agent?: unknown } | null
  if (!body || !isGuideLineId(body.line)) return NextResponse.json({ error: 'Unknown line' }, { status: 400 })

  const rate = await checkRateLimit(`onboarding:voice:${auth.user.id}`, RATE_LIMIT.limit, RATE_LIMIT.windowMs)
  if (!rate.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const apiKey = await resolveUserProviderKey(auth.user.id, 'cartesia')
  if (!apiKey) return NextResponse.json({ error: 'No Cartesia key', code: 'TTS_UNAVAILABLE' }, { status: 503 })

  const text = guideLine(body.line, {
    name: typeof body.name === 'string' ? body.name : undefined,
    agent: typeof body.agent === 'string' ? body.agent : undefined,
  })
  try {
    const audio = await synthesizeWithCartesia({ text, voiceId: GUIDE_VOICE, apiKey })
    return new Response(Buffer.from(audio), {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    console.error('[onboarding-voice]', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Voice unavailable' }, { status: 502 })
  }
}
