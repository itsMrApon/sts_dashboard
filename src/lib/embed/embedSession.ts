import 'server-only'
import type { RoomEmbedConfig } from '@prisma/client'
import { isOriginAllowed, normalizeOrigin } from '@/lib/embed/origin'
import { verifySiteKeyAgainstConfig } from '@/lib/embed/verifySiteKeyAccess'
import {
  getSessionTokenFromRequest,
  mintEmbedSession,
  readEmbedSessionToken,
  type EmbedSessionClaims,
  type MintedEmbedSession,
} from '@/lib/embed/sessionToken'

export type EmbedAccessError = { ok: false; status: number; code: string; message: string }

/** Widget flow: site key + allowlisted browser origin → short-lived embed session. */
export async function issueEmbedSessionFromSiteKey(
  request: Request,
  roomName: string,
  config: RoomEmbedConfig | null,
): Promise<{ ok: true; session: MintedEmbedSession; config: RoomEmbedConfig } | EmbedAccessError> {
  if (!config) {
    return {
      ok: false,
      status: 404,
      code: 'EMBED_NOT_CONFIGURED',
      message: 'Website embed is not configured for this business.',
    }
  }

  const keyCheck = await verifySiteKeyAgainstConfig(request, config, { requireOrigin: true })
  if (!keyCheck.ok) return keyCheck

  return {
    ok: true,
    config,
    session: mintEmbedSession({
      roomName,
      kind: 'embed',
      origin: keyCheck.origin,
      keyId: config.siteKeyPrefix,
    }),
  }
}

/** STS app pages (public chat, live-project call) — minted server-side, no site key. */
export function issueFirstPartySession(roomName: string): MintedEmbedSession {
  return mintEmbedSession({ roomName, kind: 'first-party' })
}

/**
 * Every chat / voice / callback request must carry a valid session for this room.
 * Embed sessions are re-checked against the live config so disable, key rotation,
 * or allowlist edits take effect immediately.
 */
export function verifyEmbedSessionRequest(
  request: Request,
  roomName: string,
  config: RoomEmbedConfig | null,
): { ok: true; claims: EmbedSessionClaims } | EmbedAccessError {
  const token = getSessionTokenFromRequest(request)
  if (!token) {
    return {
      ok: false,
      status: 401,
      code: 'SESSION_REQUIRED',
      message: 'A session token is required. Call the bootstrap or session endpoint first.',
    }
  }

  const parsed = readEmbedSessionToken(token)
  if (!parsed.ok) {
    return {
      ok: false,
      status: 401,
      code: parsed.code,
      message: parsed.code === 'SESSION_EXPIRED' ? 'Session expired.' : 'Invalid session.',
    }
  }

  const { claims } = parsed
  if (claims.room !== roomName) {
    return { ok: false, status: 403, code: 'SESSION_ROOM_MISMATCH', message: 'Session is not valid for this room.' }
  }

  if (claims.kind === 'first-party') return { ok: true, claims }

  if (!config?.enabled) {
    return { ok: false, status: 403, code: 'EMBED_DISABLED', message: 'Public access is disabled for this business.' }
  }
  if (config.siteKeyPrefix !== claims.kid) {
    return { ok: false, status: 401, code: 'SESSION_EXPIRED', message: 'Session expired.' }
  }
  if (!isOriginAllowed(claims.origin, config.allowedOrigins)) {
    return { ok: false, status: 403, code: 'ORIGIN_NOT_ALLOWED', message: 'This website is not allowed.' }
  }
  const requestOrigin = request.headers.get('origin')
  if (requestOrigin && normalizeOrigin(requestOrigin) !== claims.origin) {
    return { ok: false, status: 403, code: 'SESSION_ORIGIN_MISMATCH', message: 'Session was issued for another website.' }
  }

  return { ok: true, claims }
}

export function embedAccessJsonError(result: EmbedAccessError) {
  return { error: result.message, code: result.code }
}
