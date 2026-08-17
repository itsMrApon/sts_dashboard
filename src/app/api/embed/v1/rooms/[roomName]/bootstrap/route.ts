import { NextRequest, NextResponse } from 'next/server'
import { buildEmbedBootstrap } from '@/lib/embed/buildEmbedBootstrap'
import { embedCorsHeadersForError, embedCorsHeadersForRoom, embedOptionsForRoom } from '@/lib/embed/cors'
import { EMBED_RATE_LIMITS, checkRateLimit } from '@/lib/embed/rateLimit'
import {
  embedAccessJsonError,
  verifyEmbedAccess,
} from '@/lib/embed/verifyEmbedAccess'

type RouteContext = { params: Promise<{ roomName: string }> }

function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  const { roomName } = await context.params
  return embedOptionsForRoom(request, roomName)
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { roomName } = await context.params
  const corsHeaders = await embedCorsHeadersForRoom(request, roomName)

  const access = await verifyEmbedAccess(request, roomName)
  if (!access.ok) {
    return NextResponse.json(embedAccessJsonError(access), {
      status: access.status,
      headers: { ...corsHeaders, ...embedCorsHeadersForError(request) },
    })
  }

  const ip = clientIp(request)
  const rate = checkRateLimit(
    `embed:bootstrap:${roomName}:${ip}`,
    EMBED_RATE_LIMITS.bootstrap.limit,
    EMBED_RATE_LIMITS.bootstrap.windowMs,
  )
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'Too many requests', code: 'RATE_LIMITED' },
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'Retry-After': String(rate.retryAfterSec),
        },
      },
    )
  }

  const payload = await buildEmbedBootstrap(roomName)
  if (!payload) {
    return NextResponse.json(
      { error: 'Room not found', code: 'ROOM_NOT_FOUND' },
      { status: 404, headers: corsHeaders },
    )
  }

  return NextResponse.json(payload, { headers: corsHeaders })
}
