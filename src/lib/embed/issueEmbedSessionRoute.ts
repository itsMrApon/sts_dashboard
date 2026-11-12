import 'server-only'
import type { RoomEmbedConfig } from '@prisma/client'
import { NextResponse } from 'next/server'
import { clientIp } from '@/lib/embed/clientIp'
import { embedCorsHeadersForConfig, embedCorsHeadersForError, loadEmbedConfig } from '@/lib/embed/cors'
import { embedAccessJsonError, issueEmbedSessionFromSiteKey } from '@/lib/embed/embedSession'
import { rateLimitedResponse } from '@/lib/embed/embedRouteGuard'
import { checkRateLimit, type RateLimitRule } from '@/lib/embed/rateLimit'
import type { MintedEmbedSession } from '@/lib/embed/sessionToken'

/** Shared by bootstrap + session routes: rate limit → site key/origin → mint session. */
export async function issueEmbedSessionForRequest(
  request: Request,
  roomName: string,
  rateLimit: RateLimitRule & { name: string },
): Promise<
  | { ok: true; session: MintedEmbedSession; config: RoomEmbedConfig; corsHeaders: HeadersInit }
  | { ok: false; response: NextResponse }
> {
  const config = await loadEmbedConfig(roomName)
  const corsHeaders = embedCorsHeadersForConfig(request, config)

  const rate = await checkRateLimit(
    `embed:${rateLimit.name}:${roomName}:${clientIp(request)}`,
    rateLimit.limit,
    rateLimit.windowMs,
  )
  if (!rate.ok) return { ok: false, response: rateLimitedResponse(rate, corsHeaders) }

  const issued = await issueEmbedSessionFromSiteKey(request, roomName, config)
  if (!issued.ok) {
    return {
      ok: false,
      response: NextResponse.json(embedAccessJsonError(issued), {
        status: issued.status,
        headers: { ...corsHeaders, ...embedCorsHeadersForError(request) },
      }),
    }
  }

  return { ok: true, session: issued.session, config: issued.config, corsHeaders }
}

export function sessionPayload(session: MintedEmbedSession) {
  return { token: session.token, expiresAt: session.expiresAt }
}
