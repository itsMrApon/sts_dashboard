import { NextResponse } from 'next/server'
import { onAuthenticateUser } from '@/actions/auth'
import { prismaClient } from '@/lib/prismaClient'
import { clientIp } from '@/lib/embed/clientIp'
import { checkRateLimit } from '@/lib/embed/rateLimit'
import { sanitizeSteps } from '@/lib/wizard/types'
import {
  TtsUnavailableError,
  clipVersion,
  getCachedClip,
  getOrCreateClip,
} from '@/lib/wizard/wizardAudio'

type RouteContext = { params: Promise<{ slug: string; stepId: string }> }

const GENERATION_RATE_LIMIT = { limit: 20, windowMs: 60_000 }

/** Narration clip for one tour step. Cached in Postgres; immutable per `?v=` content hash. */
export async function GET(request: Request, context: RouteContext) {
  const { slug, stepId } = await context.params

  const wizard = await prismaClient.voiceWizard.findUnique({
    where: { slug },
    select: { id: true, userId: true, isPublished: true, language: true, voice: true, steps: true },
  })
  if (!wizard || wizard.language !== 'en') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!wizard.isPublished) {
    const viewer = await onAuthenticateUser()
    if (viewer.user?.id !== wizard.userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
  }

  const step = sanitizeSteps(wizard.steps).find((candidate) => candidate.id === stepId)
  if (!step) return NextResponse.json({ error: 'Step not found' }, { status: 404 })

  const requestedVersion = new URL(request.url).searchParams.get('v')
  const currentVersion = clipVersion(wizard.voice, step)

  try {
    const clipInput = { wizardId: wizard.id, voice: wizard.voice, step, ownerUserId: wizard.userId }
    let clip = await getCachedClip(clipInput)
    if (!clip) {
      // Only uncached clips cost money — cap generation per IP.
      const rate = await checkRateLimit(
        `wizard:audio:${clientIp(request)}`,
        GENERATION_RATE_LIMIT.limit,
        GENERATION_RATE_LIMIT.windowMs,
      )
      if (!rate.ok) {
        return NextResponse.json(
          { error: 'Too many requests' },
          { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } },
        )
      }
      clip = await getOrCreateClip(clipInput)
    }

    const cacheControl =
      wizard.isPublished && requestedVersion === currentVersion
        ? 'public, max-age=31536000, immutable'
        : 'private, no-store'

    return new Response(Buffer.from(clip.audio), {
      headers: {
        'Content-Type': clip.mimeType,
        'Content-Length': String(clip.audio.byteLength),
        'Cache-Control': cacheControl,
        ETag: `"${currentVersion}"`,
      },
    })
  } catch (error) {
    if (error instanceof TtsUnavailableError) {
      return NextResponse.json({ error: 'Voice unavailable', code: 'TTS_UNAVAILABLE' }, { status: 503 })
    }
    console.error('[wizard-audio]', error)
    return NextResponse.json({ error: 'Failed to generate audio' }, { status: 502 })
  }
}
