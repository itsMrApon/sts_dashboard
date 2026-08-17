import { NextResponse } from 'next/server'
import { embedCorsHeadersForError, embedCorsHeadersForRoom, embedOptionsForRoom } from '@/lib/embed/cors'
import { checkRateLimit } from '@/lib/embed/rateLimit'
import {
  embedAccessJsonError,
  verifyEmbedAccess,
} from '@/lib/embed/verifyEmbedAccess'

export function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function guardEmbedRequest(
  request: Request,
  roomName: string,
  rateLimit?: { key: string; limit: number; windowMs: number },
) {
  const corsHeaders = await embedCorsHeadersForRoom(request, roomName)

  const access = await verifyEmbedAccess(request, roomName)
  if (!access.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(embedAccessJsonError(access), {
        status: access.status,
        headers: { ...corsHeaders, ...embedCorsHeadersForError(request) },
      }),
    }
  }

  if (rateLimit) {
    const rate = checkRateLimit(rateLimit.key, rateLimit.limit, rateLimit.windowMs)
    if (!rate.ok) {
      return {
        ok: false as const,
        response: NextResponse.json(
          { error: 'Too many requests', code: 'RATE_LIMITED' },
          {
            status: 429,
            headers: {
              ...corsHeaders,
              'Retry-After': String(rate.retryAfterSec),
            },
          },
        ),
      }
    }
  }

  return {
    ok: true as const,
    access,
    corsHeaders,
  }
}

export async function embedOptions(request: Request, roomName: string) {
  return embedOptionsForRoom(request, roomName)
}

export function jsonWithCors<T>(data: T, corsHeaders: HeadersInit, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...corsHeaders,
    },
  })
}
