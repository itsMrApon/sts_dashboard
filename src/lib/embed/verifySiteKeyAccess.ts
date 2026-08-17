import type { RoomEmbedConfig } from '@prisma/client'
import { getRequestOrigin, isOriginAllowed, isSameAppOrigin } from '@/lib/embed/origin'
import { verifySiteKey } from '@/lib/embed/siteKey'

export const SITE_KEY_HEADER = 'x-sts-site-key'

export function getSiteKeyFromRequest(request: Request): string {
  return request.headers.get(SITE_KEY_HEADER)?.trim() || ''
}

export type SiteKeyAccessResult =
  | { ok: true }
  | { ok: false; status: number; code: string; message: string }

type VerifyOptions = {
  /** When true, missing site key is allowed for same-origin STS app requests. */
  allowSameOriginWithoutKey?: boolean
  /** When false, disabled embed configs reject the request. */
  requireEnabled?: boolean
}

export function verifySiteKeyAgainstConfig(
  request: Request,
  config: RoomEmbedConfig,
  options: VerifyOptions = {},
): SiteKeyAccessResult {
  const { allowSameOriginWithoutKey = false, requireEnabled = true } = options

  if (requireEnabled && !config.enabled) {
    return {
      ok: false,
      status: 403,
      code: 'EMBED_DISABLED',
      message: 'Public access is disabled for this business.',
    }
  }

  const siteKey = getSiteKeyFromRequest(request)
  if (!siteKey) {
    if (allowSameOriginWithoutKey && isSameAppOrigin(request)) {
      return { ok: true }
    }
    return {
      ok: false,
      status: 401,
      code: 'SITE_KEY_REQUIRED',
      message: 'X-Sts-Site-Key header is required.',
    }
  }

  if (!verifySiteKey(siteKey, config.siteKeyHash)) {
    return {
      ok: false,
      status: 401,
      code: 'INVALID_SITE_KEY',
      message: 'Invalid site key.',
    }
  }

  const origin = getRequestOrigin(request)
  if (origin && config.allowedOrigins.length > 0 && !isOriginAllowed(origin, config.allowedOrigins)) {
    return {
      ok: false,
      status: 403,
      code: 'ORIGIN_NOT_ALLOWED',
      message: `Origin is not allowed. Allowed: ${config.allowedOrigins.join(', ')}`,
    }
  }

  return { ok: true }
}
