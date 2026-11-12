import 'server-only'
import { NextResponse } from 'next/server'
import { clientIp } from '@/lib/embed/clientIp'
import {
  embedCorsHeadersForConfig,
  embedCorsHeadersForError,
  embedOptionsForRoom,
  loadEmbedConfig,
} from '@/lib/embed/cors'
import { embedAccessJsonError, verifyEmbedSessionRequest } from '@/lib/embed/embedSession'
import {
  checkRateLimit,
  consumeDailyQuota,
  type RateLimitResult,
  type RateLimitRule,
} from '@/lib/embed/rateLimit'

export { clientIp } from '@/lib/embed/clientIp'

export type EmbedGuardPolicy = {
  scope: 'chat' | 'voice' | 'mobile' | 'form' | 'read'
  perSession?: RateLimitRule
  perIp?: RateLimitRule
  /** Per-room cap per UTC day. */
  dailyQuota?: number
}

export function rateLimitedResponse(
  rate: Extract<RateLimitResult, { ok: false }>,
  corsHeaders: HeadersInit,
  code = 'RATE_LIMITED',
) {
  return NextResponse.json(
    { error: code === 'DAILY_QUOTA_EXCEEDED' ? 'Daily usage limit reached for this business.' : 'Too many requests', code },
    { status: 429, headers: { ...corsHeaders, 'Retry-After': String(rate.retryAfterSec) } },
  )
}

/** Session token + per-session / per-IP rate limits + per-room daily quota. */
export async function guardEmbedRequest(request: Request, roomName: string, policy: EmbedGuardPolicy) {
  const config = await loadEmbedConfig(roomName)
  const corsHeaders = embedCorsHeadersForConfig(request, config)

  const access = verifyEmbedSessionRequest(request, roomName, config)
  if (!access.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(embedAccessJsonError(access), {
        status: access.status,
        headers: { ...corsHeaders, ...embedCorsHeadersForError(request) },
      }),
    }
  }

  const { claims } = access
  const ip = clientIp(request)
  const [sessionRate, ipRate] = await Promise.all([
    policy.perSession
      ? checkRateLimit(`embed:${policy.scope}:sid:${claims.sid}`, policy.perSession.limit, policy.perSession.windowMs)
      : null,
    policy.perIp
      ? checkRateLimit(`embed:${policy.scope}:ip:${roomName}:${ip}`, policy.perIp.limit, policy.perIp.windowMs)
      : null,
  ])
  const limited = [sessionRate, ipRate].find((rate) => rate && !rate.ok)
  if (limited && !limited.ok) {
    return { ok: false as const, response: rateLimitedResponse(limited, corsHeaders) }
  }

  // Quota is consumed only after rate limits pass, so throttled spam does not burn the budget.
  if (policy.dailyQuota) {
    const quota = await consumeDailyQuota(`embed:${policy.scope}:${roomName}`, policy.dailyQuota)
    if (!quota.ok) {
      return { ok: false as const, response: rateLimitedResponse(quota, corsHeaders, 'DAILY_QUOTA_EXCEEDED') }
    }
  }

  return { ok: true as const, claims, config, corsHeaders }
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
