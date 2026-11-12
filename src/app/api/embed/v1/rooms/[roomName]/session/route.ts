import { NextRequest, NextResponse } from 'next/server'
import { embedOptionsForRoom } from '@/lib/embed/cors'
import { issueEmbedSessionForRequest, sessionPayload } from '@/lib/embed/issueEmbedSessionRoute'
import { EMBED_RATE_LIMITS } from '@/lib/embed/rateLimit'

type RouteContext = { params: Promise<{ roomName: string }> }

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  const { roomName } = await context.params
  return embedOptionsForRoom(request, roomName)
}

/** Lightweight session refresh for the widget (no bootstrap payload). */
export async function POST(request: NextRequest, context: RouteContext) {
  const { roomName } = await context.params

  const issued = await issueEmbedSessionForRequest(request, roomName, {
    name: 'session',
    ...EMBED_RATE_LIMITS.session,
  })
  if (!issued.ok) return issued.response

  return NextResponse.json(sessionPayload(issued.session), {
    headers: { ...issued.corsHeaders, 'Cache-Control': 'no-store' },
  })
}
