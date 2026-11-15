import { NextRequest, NextResponse } from 'next/server'
import { embedCorsHeadersForError, embedCorsHeadersForRoom, embedOptionsForRoom } from '@/lib/embed/cors'
import { issueEmbedSessionForRequest, sessionPayload } from '@/lib/embed/issueEmbedSessionRoute'
import { EMBED_RATE_LIMITS } from '@/lib/embed/rateLimit'
import { withRouteErrors } from '@/lib/http/routeErrors'

type RouteContext = { params: Promise<{ roomName: string }> }

const ERROR_CORS = {
  corsHeaders: async (request: Request, context: RouteContext) => ({
    ...embedCorsHeadersForError(request),
    ...(await embedCorsHeadersForRoom(request, (await context.params).roomName)),
  }),
}

export const OPTIONS = withRouteErrors('api/embed/v1/rooms/[roomName]/session', async function OPTIONS(request: NextRequest, context: RouteContext) {
  const { roomName } = await context.params
  return embedOptionsForRoom(request, roomName)
}, ERROR_CORS)

/** Lightweight session refresh for the widget (no bootstrap payload). */
export const POST = withRouteErrors('api/embed/v1/rooms/[roomName]/session', async function POST(request: NextRequest, context: RouteContext) {
  const { roomName } = await context.params

  const issued = await issueEmbedSessionForRequest(request, roomName, {
    name: 'session',
    ...EMBED_RATE_LIMITS.session,
  })
  if (!issued.ok) return issued.response

  return NextResponse.json(sessionPayload(issued.session), {
    headers: { ...issued.corsHeaders, 'Cache-Control': 'no-store' },
  })
}, ERROR_CORS)
