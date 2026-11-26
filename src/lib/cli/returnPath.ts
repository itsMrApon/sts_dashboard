/**
 * After sign-in everyone goes to /callback then /home. The one exception: a creator who opened the
 * CLI approve page signed out comes back to it, or their login code would be lost. Only that path
 * is accepted, so this can't be used to send people anywhere else.
 */
export function cliReturnPath(raw: string | string[] | undefined | null): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return null
  let url: URL
  try {
    url = new URL(value, 'http://local.invalid')
  } catch {
    return null
  }
  if (url.pathname !== '/cli/authorize') return null
  const code = url.searchParams.get('code') ?? ''
  if (!/^[A-Za-z0-9-]{1,20}$/.test(code)) return null
  return `/cli/authorize?code=${encodeURIComponent(code)}`
}
