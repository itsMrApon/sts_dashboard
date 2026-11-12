import type {
  ChatReply,
  EmbedBootstrap,
  EmbedSession,
  LiveKitConnectionDetails,
  StsAiClientOptions,
} from './types'

const SITE_KEY_HEADER = 'X-Sts-Site-Key'

const bootstrapInflight = new Map<string, Promise<EmbedBootstrap>>()
const sessionCache = new Map<string, EmbedSession>()
const sessionInflight = new Map<string, Promise<string>>()
const SESSION_REFRESH_MARGIN_MS = 60_000
const SESSION_ERROR_CODES = new Set(['SESSION_REQUIRED', 'SESSION_INVALID', 'SESSION_EXPIRED'])

function trimBase(url: string) {
  return url.replace(/\/$/, '')
}

function bootstrapCacheKey(options: StsAiClientOptions) {
  return `${trimBase(options.apiBase)}|${options.roomName}|${options.siteKey}`
}

async function fetchBootstrap(options: StsAiClientOptions): Promise<EmbedBootstrap> {
  const apiBase = trimBase(options.apiBase)
  const roomEncoded = encodeURIComponent(options.roomName)

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    [SITE_KEY_HEADER]: options.siteKey,
  }

  let res: Response
  try {
    res = await fetch(`${apiBase}/api/embed/v1/rooms/${roomEncoded}/bootstrap`, {
      method: 'GET',
      headers,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error'
    throw new Error(
      msg.includes('Load failed') || msg.includes('Failed to fetch')
        ? `Cannot reach STS-AI at ${apiBase}. Is the server running? Check CORS and NEXT_PUBLIC_STS_AI_URL.`
        : msg,
    )
  }
  const data = (await res.json().catch(() => ({}))) as EmbedBootstrap & {
    error?: string
    code?: string
  }
  if (!res.ok) {
    throw new Error(data?.error || `Bootstrap failed (${res.status})`)
  }
  if (data.session?.token) {
    sessionCache.set(bootstrapCacheKey(options), data.session)
  }
  return data as EmbedBootstrap
}

async function requestSession(options: StsAiClientOptions): Promise<string> {
  const apiBase = trimBase(options.apiBase)
  const res = await fetch(
    `${apiBase}/api/embed/v1/rooms/${encodeURIComponent(options.roomName)}/session`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [SITE_KEY_HEADER]: options.siteKey },
    },
  )
  const data = (await res.json().catch(() => ({}))) as Partial<EmbedSession> & { error?: string }
  if (!res.ok || !data.token || !data.expiresAt) {
    throw new Error(data?.error || `Session request failed (${res.status})`)
  }
  sessionCache.set(bootstrapCacheKey(options), { token: data.token, expiresAt: data.expiresAt })
  return data.token
}

/** Short-lived session token; reuses the bootstrap session and refreshes before expiry. */
async function getSessionToken(options: StsAiClientOptions, forceRefresh = false): Promise<string> {
  const key = bootstrapCacheKey(options)
  if (!forceRefresh) {
    await getOrCreateBootstrapPromise(options).catch(() => undefined)
    const cached = sessionCache.get(key)
    if (cached && cached.expiresAt - SESSION_REFRESH_MARGIN_MS > Date.now()) return cached.token
  }

  let pending = sessionInflight.get(key)
  if (!pending) {
    pending = requestSession(options).finally(() => sessionInflight.delete(key))
    sessionInflight.set(key, pending)
  }
  return pending
}

function getOrCreateBootstrapPromise(options: StsAiClientOptions): Promise<EmbedBootstrap> {
  const key = bootstrapCacheKey(options)
  let pending = bootstrapInflight.get(key)
  if (!pending) {
    pending = fetchBootstrap(options)
    bootstrapInflight.set(key, pending)
    void pending.catch(() => bootstrapInflight.delete(key))
  }
  return pending
}

/** Warm bootstrap while the embed chunk is still downloading. */
export function prefetchStsAiBootstrap(options: StsAiClientOptions): void {
  void getOrCreateBootstrapPromise(options)
}

export function createStsAiClient(options: StsAiClientOptions) {
  const apiBase = trimBase(options.apiBase)
  const roomEncoded = encodeURIComponent(options.roomName)

  async function authedFetch(url: string, init: RequestInit): Promise<Response> {
    const send = async (forceRefresh: boolean) => {
      const token = await getSessionToken(options, forceRefresh)
      return fetch(url, {
        ...init,
        headers: { 'Content-Type': 'application/json', 'X-Sts-Session': token },
      })
    }
    const res = await send(false)
    if (res.status !== 401) return res
    const body = (await res.clone().json().catch(() => null)) as { code?: string } | null
    return body?.code && SESSION_ERROR_CODES.has(body.code) ? send(true) : res
  }

  async function bootstrap(): Promise<EmbedBootstrap> {
    return getOrCreateBootstrapPromise(options)
  }

  async function sendChat(message: string, sessionId: string): Promise<ChatReply> {
    const res = await authedFetch(`${apiBase}/api/chat/${roomEncoded}`, {
      method: 'POST',
      body: JSON.stringify({ message, sessionId }),
    })
    return res.json() as Promise<ChatReply>
  }

  async function submitMobileCallback(payload: {
    name: string
    countryCode: string
    phone: string
    note: string
    consent: boolean
  }): Promise<{ ok?: boolean; error?: string; warning?: string }> {
    const res = await authedFetch(`${apiBase}/api/chat/${roomEncoded}/mobile-callback`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return res.json()
  }

  async function getLiveKitConnectionDetails(body: {
    roomName: string
    participantName: string
    assistantId?: string
  }): Promise<LiveKitConnectionDetails> {
    const res = await authedFetch(`${apiBase}/api/livekit/connection-details?roomName=${encodeURIComponent(options.roomName)}`, {
      method: 'POST',
      body: JSON.stringify({
        roomName: body.roomName,
        participantName: body.participantName,
        assistantId: body.assistantId ?? 'saas-agent',
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`LiveKit connection failed: ${res.status} ${text}`)
    }
    return res.json()
  }

  return {
    bootstrap,
    sendChat,
    submitMobileCallback,
    getLiveKitConnectionDetails,
  }
}

export type StsAiClient = ReturnType<typeof createStsAiClient>
