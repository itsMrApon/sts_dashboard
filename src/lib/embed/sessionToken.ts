import 'server-only'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Short-lived, HMAC-signed session token for anonymous widget visitors.
 * Minted after the site key + origin check (embed) or by the STS app itself (first-party),
 * then required by chat / voice / callback endpoints.
 */

const TOKEN_PREFIX = 'sts_es'
const TOKEN_VERSION = 1
export const EMBED_SESSION_TTL_MS = 15 * 60_000

export type EmbedSessionKind = 'embed' | 'first-party'

export type EmbedSessionClaims = {
  v: typeof TOKEN_VERSION
  room: string
  kind: EmbedSessionKind
  /** Browser origin the embed session was minted for (embed only). */
  origin: string | null
  /** Site key prefix at mint time — key rotation invalidates outstanding sessions. */
  kid: string | null
  sid: string
  iat: number
  exp: number
}

export type MintedEmbedSession = {
  token: string
  expiresAt: number
  claims: EmbedSessionClaims
}

let cachedSecret: Buffer | null = null

function sessionSecret(): Buffer {
  if (cachedSecret) return cachedSecret
  const explicit = process.env.EMBED_SESSION_SECRET?.trim()
  if (explicit) {
    cachedSecret = Buffer.from(explicit, 'utf8')
    return cachedSecret
  }
  // Derived fallback so existing deploys keep working; set EMBED_SESSION_SECRET to decouple.
  const clerkSecret = process.env.CLERK_SECRET_KEY?.trim()
  if (clerkSecret) {
    cachedSecret = createHmac('sha256', clerkSecret).update('sts-embed-session-v1').digest()
    return cachedSecret
  }
  if (process.env.NODE_ENV === 'development') {
    cachedSecret = Buffer.from('sts-dev-only-embed-session-secret', 'utf8')
    return cachedSecret
  }
  throw new Error('EMBED_SESSION_SECRET is not configured')
}

function sign(encodedPayload: string): string {
  return createHmac('sha256', sessionSecret()).update(encodedPayload).digest('base64url')
}

export function mintEmbedSession(input: {
  roomName: string
  kind: EmbedSessionKind
  origin?: string | null
  keyId?: string | null
}): MintedEmbedSession {
  const issuedAt = Date.now()
  const claims: EmbedSessionClaims = {
    v: TOKEN_VERSION,
    room: input.roomName,
    kind: input.kind,
    origin: input.origin ?? null,
    kid: input.keyId ?? null,
    sid: randomBytes(12).toString('base64url'),
    iat: issuedAt,
    exp: issuedAt + EMBED_SESSION_TTL_MS,
  }
  const encodedPayload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url')
  return {
    token: `${TOKEN_PREFIX}.${encodedPayload}.${sign(encodedPayload)}`,
    expiresAt: claims.exp,
    claims,
  }
}

export type SessionTokenCheck =
  | { ok: true; claims: EmbedSessionClaims }
  | { ok: false; code: 'SESSION_INVALID' | 'SESSION_EXPIRED' }

export function readEmbedSessionToken(token: string): SessionTokenCheck {
  const [prefix, encodedPayload, signature] = token.split('.')
  if (prefix !== TOKEN_PREFIX || !encodedPayload || !signature) {
    return { ok: false, code: 'SESSION_INVALID' }
  }

  const expected = Buffer.from(sign(encodedPayload), 'base64url')
  const actual = Buffer.from(signature, 'base64url')
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, code: 'SESSION_INVALID' }
  }

  let claims: EmbedSessionClaims
  try {
    claims = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
  } catch {
    return { ok: false, code: 'SESSION_INVALID' }
  }

  if (claims?.v !== TOKEN_VERSION || typeof claims.room !== 'string' || typeof claims.sid !== 'string') {
    return { ok: false, code: 'SESSION_INVALID' }
  }
  if (typeof claims.exp !== 'number' || claims.exp <= Date.now()) {
    return { ok: false, code: 'SESSION_EXPIRED' }
  }
  return { ok: true, claims }
}

/** Custom header — `Authorization: Bearer` is claimed by Clerk middleware as a Clerk JWT. */
export const EMBED_SESSION_HEADER = 'x-sts-session'

export function getSessionTokenFromRequest(request: Request): string {
  return request.headers.get(EMBED_SESSION_HEADER)?.trim() || ''
}
