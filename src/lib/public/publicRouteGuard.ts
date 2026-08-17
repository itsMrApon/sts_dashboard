import { NextResponse } from 'next/server'
import { embedCorsHeadersForError } from '@/lib/embed/cors'
import { checkRateLimit } from '@/lib/embed/rateLimit'
import { publicCorsHeadersForWorkspace } from '@/lib/public/cors'
import {
  publicAccessJsonError,
  verifyPublicAccess,
} from '@/lib/public/verifyPublicAccess'

export const PUBLIC_RATE_LIMITS = {
  profile: { limit: 60, windowMs: 60_000 },
  services: { limit: 120, windowMs: 60_000 },
} as const

export function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function guardPublicRequest(
  request: Request,
  workspaceId: string,
  rateLimit?: { key: string; limit: number; windowMs: number },
) {
  const corsHeaders = await publicCorsHeadersForWorkspace(request, workspaceId)

  const access = await verifyPublicAccess(request, workspaceId)
  if (!access.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(publicAccessJsonError(access), {
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

export function jsonWithCors<T>(data: T, corsHeaders: HeadersInit, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...corsHeaders,
    },
  })
}
