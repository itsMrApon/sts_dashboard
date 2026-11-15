import { NextRequest, NextResponse } from 'next/server'
import { buildEmbedBootstrap } from '@/lib/embed/buildEmbedBootstrap'
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

export const OPTIONS = withRouteErrors('api/embed/v1/rooms/[roomName]/bootstrap', async function OPTIONS(request: NextRequest, context: RouteContext) {
  const { roomName } = await context.params
  return embedOptionsForRoom(request, roomName)
}, ERROR_CORS)

export const GET = withRouteErrors('api/embed/v1/rooms/[roomName]/bootstrap', async function GET(request: NextRequest, context: RouteContext) {
  const { roomName } = await context.params

  const issued = await issueEmbedSessionForRequest(request, roomName, {
    name: 'bootstrap',
    ...EMBED_RATE_LIMITS.bootstrap,
  })
  if (!issued.ok) return issued.response

  const payload = await buildEmbedBootstrap(roomName)
  if (!payload) {
    return NextResponse.json(
      { error: 'Room not found', code: 'ROOM_NOT_FOUND' },
      { status: 404, headers: issued.corsHeaders },
    )
  }

  return NextResponse.json(
    { ...payload, session: sessionPayload(issued.session) },
    { headers: { ...issued.corsHeaders, 'Cache-Control': 'no-store' } },
  )
}, ERROR_CORS)
