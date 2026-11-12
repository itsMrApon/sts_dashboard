import type { RoomEmbedConfig } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { getRequestOrigin, isOriginAllowed } from '@/lib/embed/origin'
import { hashSiteKey, verifySiteKey } from '@/lib/embed/siteKey'

export const SITE_KEY_HEADER = 'x-sts-site-key'

export function getSiteKeyFromRequest(request: Request): string {
  return request.headers.get(SITE_KEY_HEADER)?.trim() || ''
}

export type SiteKeyAccessResult =
  | { ok: true; origin: string | null }
  | { ok: false; status: number; code: string; message: string }

type VerifyOptions = {
  /** Browser-only callers (widget session mint) must present an Origin header. */
  requireOrigin?: boolean
}

/**
 * Verifies site key + origin allowlist against an embed config.
 * Fails closed: disabled config, empty allowlist, or unlisted origin are rejected.
 * Requests without Origin (server-to-server) are only allowed when `requireOrigin` is false.
 */
export async function verifySiteKeyAgainstConfig(
  request: Request,
  config: RoomEmbedConfig,
  options: VerifyOptions = {},
): Promise<SiteKeyAccessResult> {
  if (!config.enabled) {
    return {
      ok: false,
      status: 403,
      code: 'EMBED_DISABLED',
      message: 'Public access is disabled for this business.',
    }
  }

  const origin = getRequestOrigin(request)
  if (origin) {
    if (!isOriginAllowed(origin, config.allowedOrigins)) {
      return {
        ok: false,
        status: 403,
        code: config.allowedOrigins.length === 0 ? 'ORIGIN_ALLOWLIST_EMPTY' : 'ORIGIN_NOT_ALLOWED',
        message: 'This website is not allowed to use this site key.',
      }
    }
  } else if (options.requireOrigin) {
    return {
      ok: false,
      status: 403,
      code: 'ORIGIN_REQUIRED',
      message: 'Embedded sessions must be requested from a browser on an allowed website.',
    }
  }

  const siteKey = getSiteKeyFromRequest(request)
  if (!siteKey) {
    return {
      ok: false,
      status: 401,
      code: 'SITE_KEY_REQUIRED',
      message: 'X-Sts-Site-Key header is required.',
    }
  }

  const keyCheck = await verifySiteKey(siteKey, config.siteKeyHash)
  if (!keyCheck.ok) {
    return { ok: false, status: 401, code: 'INVALID_SITE_KEY', message: 'Invalid site key.' }
  }

  if (keyCheck.needsRehash) {
    // Lazy migration from legacy scrypt hashes to fast SHA-256.
    void prismaClient.roomEmbedConfig
      .update({ where: { id: config.id }, data: { siteKeyHash: hashSiteKey(siteKey) } })
      .catch((error) => console.warn('[site-key] rehash failed', error))
  }

  return { ok: true, origin }
}
