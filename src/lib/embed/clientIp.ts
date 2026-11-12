type HeaderSource = Request | Headers

/**
 * Client IP from headers set by the edge/proxy, not by the client.
 * `x-forwarded-for[0]` is client-controlled when proxies append, so it is the last resort
 * and we take the right-most hop (the one our proxy appended).
 */
export function clientIp(source: HeaderSource): string {
  const headers = source instanceof Headers ? source : source.headers
  const platformIp =
    headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('cf-connecting-ip')?.trim() ||
    headers.get('x-real-ip')?.trim()
  if (platformIp) return platformIp

  const forwardedHops = headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((hop) => hop.trim())
    .filter(Boolean)
  return forwardedHops?.at(-1) || 'unknown'
}
