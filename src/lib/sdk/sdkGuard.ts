import 'server-only'
import { NextResponse } from 'next/server'
import { prismaClient } from '@/lib/prismaClient'
import { getBusinessByRoomName, type CreatorBusiness } from '@/lib/business/creatorBusiness'
import { embedCorsHeadersForError } from '@/lib/embed/cors'
import { guardEmbedRequest, type EmbedGuardPolicy } from '@/lib/embed/embedRouteGuard'
import { isDevLocalhostOrigin, normalizeOrigin } from '@/lib/embed/origin'
import { getSessionTokenFromRequest, readEmbedSessionToken, type EmbedSessionClaims } from '@/lib/embed/sessionToken'

const SDK_CORS_BASE = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Sts-Site-Key, X-Sts-Session',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
}

/**
 * CORS when the business isn't known yet (preflight, session errors): the origin must be on
 * some enabled business's allowlist. Per-business checks still run on every real request.
 */
export async function sdkCorsHeaders(request: Request): Promise<HeadersInit> {
  const origin = normalizeOrigin(request.headers.get('origin') || '')
  if (!origin) return {}
  if (isDevLocalhostOrigin(origin)) return { ...SDK_CORS_BASE, 'Access-Control-Allow-Origin': origin }
  const match = await prismaClient.roomEmbedConfig.findFirst({
    where: { enabled: true, allowedOrigins: { has: origin } },
    select: { id: true },
  })
  return match ? { ...SDK_CORS_BASE, 'Access-Control-Allow-Origin': origin } : {}
}

export async function sdkOptions(request: Request) {
  return new Response(null, { status: 204, headers: await sdkCorsHeaders(request) })
}

export async function sdkError(request: Request, status: number, code: string, error: string) {
  return NextResponse.json(
    { error, code },
    { status, headers: { ...(await sdkCorsHeaders(request)), ...embedCorsHeadersForError(request) } },
  )
}

export type SdkGuardOk = {
  ok: true
  business: CreatorBusiness
  claims: EmbedSessionClaims
  corsHeaders: HeadersInit
}

/**
 * Every SDK call (after /session) carries `X-Sts-Session`. The token names the business room;
 * the shared embed guard then enforces signature, origin, allowlist, rate limits and quotas.
 */
export async function guardSdkRequest(
  request: Request,
  policy: EmbedGuardPolicy,
): Promise<SdkGuardOk | { ok: false; response: Response }> {
  const token = getSessionTokenFromRequest(request)
  if (!token) {
    return { ok: false, response: await sdkError(request, 401, 'SESSION_REQUIRED', 'Call /api/sdk/v1/session first.') }
  }
  const parsed = readEmbedSessionToken(token)
  if (!parsed.ok) {
    return { ok: false, response: await sdkError(request, 401, parsed.code, 'Session expired or invalid.') }
  }

  const guard = await guardEmbedRequest(request, parsed.claims.room, policy)
  if (!guard.ok) return { ok: false, response: guard.response }

  const business = await getBusinessByRoomName(parsed.claims.room)
  if (!business) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Business not found', code: 'BUSINESS_NOT_FOUND' }, { status: 404, headers: guard.corsHeaders }),
    }
  }
  return { ok: true, business, claims: guard.claims, corsHeaders: guard.corsHeaders }
}

export function sdkJson<T>(data: T, corsHeaders: HeadersInit, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { 'Cache-Control': 'no-store', ...(init?.headers || {}), ...corsHeaders },
  })
}

export function serviceDisabled(corsHeaders: HeadersInit, service: string) {
  return sdkJson(
    { error: `${service} is turned off for this business.`, code: 'SERVICE_DISABLED' },
    corsHeaders,
    { status: 403 },
  )
}
