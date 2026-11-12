import { getFirstPartyEmbedSession } from '@/actions/embedSession'

/** Client-side cache for first-party session tokens (one per room, refreshed before expiry). */

const REFRESH_MARGIN_MS = 60_000
const SESSION_ERROR_CODES = new Set(['SESSION_REQUIRED', 'SESSION_INVALID', 'SESSION_EXPIRED'])

type CachedSession = { token: string; expiresAt: number }

const sessionCache = new Map<string, CachedSession>()
const sessionInflight = new Map<string, Promise<string>>()

export async function getFirstPartySessionToken(
  roomName: string,
  options: { forceRefresh?: boolean } = {},
): Promise<string> {
  const cached = sessionCache.get(roomName)
  if (!options.forceRefresh && cached && cached.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
    return cached.token
  }

  let pending = sessionInflight.get(roomName)
  if (!pending) {
    pending = getFirstPartyEmbedSession(roomName)
      .then((result) => {
        if (!result.ok) throw new Error(result.error)
        sessionCache.set(roomName, { token: result.token, expiresAt: result.expiresAt })
        return result.token
      })
      .finally(() => sessionInflight.delete(roomName))
    sessionInflight.set(roomName, pending)
  }
  return pending
}

/** fetch() with the room session attached; refreshes once if the server rejects the session. */
export async function fetchWithFirstPartySession(
  roomName: string,
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const send = async (forceRefresh: boolean) => {
    const token = await getFirstPartySessionToken(roomName, { forceRefresh })
    const headers = new Headers(init.headers)
    headers.set('X-Sts-Session', token)
    return fetch(input, { ...init, headers })
  }

  const response = await send(false)
  if (response.status !== 401) return response

  const body = (await response.clone().json().catch(() => null)) as { code?: string } | null
  if (!body?.code || !SESSION_ERROR_CODES.has(body.code)) return response
  return send(true)
}
