/** Normalize to origin only: `https://primeone.com` */
export function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const url = new URL(withProtocol)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.origin
  } catch {
    return null
  }
}

export function normalizeOrigins(values: string[]): string[] {
  const seen = new Set<string>()
  for (const value of values) {
    const origin = normalizeOrigin(value)
    if (origin) seen.add(origin)
  }
  return [...seen]
}

export function getRequestOrigin(request: Request): string | null {
  const origin = request.headers.get('origin')
  if (origin) return normalizeOrigin(origin)

  const referer = request.headers.get('referer')
  if (!referer) return null
  try {
    return new URL(referer).origin
  } catch {
    return null
  }
}

export function isLocalhostOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

/** In development, allow any localhost port for creator site testing. */
export function isDevLocalhostOrigin(origin: string | null): boolean {
  if (process.env.NODE_ENV !== 'development' || !origin) return false
  const normalized = normalizeOrigin(origin)
  return normalized ? isLocalhostOrigin(normalized) : false
}

/** Strict allowlist: an empty list allows nothing (dev localhost excepted). */
export function isOriginAllowed(
  origin: string | null,
  allowedOrigins: string[],
): boolean {
  if (!origin) return false
  const normalized = normalizeOrigin(origin)
  if (!normalized) return false
  if (allowedOrigins.includes(normalized)) return true
  return isDevLocalhostOrigin(normalized)
}
