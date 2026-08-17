import type { ChatReply, EmbedBootstrap, LiveKitConnectionDetails, StsAiClientOptions } from './types'

const SITE_KEY_HEADER = 'X-Sts-Site-Key'

const bootstrapInflight = new Map<string, Promise<EmbedBootstrap>>()

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
  return data as EmbedBootstrap
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

  const headers = (): HeadersInit => ({
    'Content-Type': 'application/json',
    [SITE_KEY_HEADER]: options.siteKey,
  })

  async function bootstrap(): Promise<EmbedBootstrap> {
    return getOrCreateBootstrapPromise(options)
  }

  async function sendChat(message: string, sessionId: string): Promise<ChatReply> {
    const res = await fetch(`${apiBase}/api/chat/${roomEncoded}`, {
      method: 'POST',
      headers: headers(),
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
    const res = await fetch(`${apiBase}/api/chat/${roomEncoded}/mobile-callback`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload),
    })
    return res.json()
  }

  async function getLiveKitConnectionDetails(body: {
    roomName: string
    participantName: string
    assistantId?: string
  }): Promise<LiveKitConnectionDetails> {
    const res = await fetch(`${apiBase}/api/livekit/connection-details?roomName=${encodeURIComponent(options.roomName)}`, {
      method: 'POST',
      headers: headers(),
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
