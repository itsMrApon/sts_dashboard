import {
  StsError,
  type StsAnswer,
  type StsReview,
  type StsBusiness,
  type StsChatReply,
  type StsChatUpload,
  type StsForm,
  type StsFormAnswer,
  type StsOptions,
  type StsSessionInfo,
  type StsSpeakConnection,
  type StsWizard,
} from './types.js'

const SESSION_HEADER = 'X-Sts-Session'
const SITE_KEY_HEADER = 'X-Sts-Site-Key'
const REFRESH_MARGIN_MS = 60_000
const SESSION_ERRORS = new Set(['SESSION_REQUIRED', 'SESSION_INVALID', 'SESSION_EXPIRED'])

type SessionState = { token: string; expiresAt: number; info: StsSessionInfo }

type ErrorBody = { error?: string; code?: string; fieldId?: string | null }

async function readJson<T>(response: Response): Promise<T & ErrorBody> {
  return (await response.json().catch(() => ({}))) as T & ErrorBody
}

function toError(response: Response, body: ErrorBody): StsError {
  return new StsError(body.error || `Request failed (${response.status})`, body.code || 'REQUEST_FAILED', response.status, body.fieldId ?? null)
}

/**
 * Framework-agnostic STS-AI client. One instance per site.
 * Handles the site-key → session exchange and refreshes the session before it expires.
 */
export function createSts(options: StsOptions) {
  const apiBase = options.apiBase.replace(/\/$/, '')
  let session: SessionState | null = null
  let pending: Promise<SessionState> | null = null

  async function openSession(): Promise<SessionState> {
    const response = await fetch(`${apiBase}/api/sdk/v1/session`, {
      method: 'POST',
      headers: { [SITE_KEY_HEADER]: options.siteKey },
    })
    const body = await readJson<{ session: { token: string; expiresAt: number } } & StsSessionInfo>(response)
    if (!response.ok || !body.session) throw toError(response, body)
    session = {
      token: body.session.token,
      expiresAt: body.session.expiresAt,
      info: { business: body.business, services: body.services },
    }
    return session
  }

  async function ensureSession(force = false): Promise<SessionState> {
    if (!force && session && session.expiresAt - REFRESH_MARGIN_MS > Date.now()) return session
    if (!pending) pending = openSession().finally(() => (pending = null))
    return pending
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const send = async (force: boolean) => {
      const { token } = await ensureSession(force)
      const headers = new Headers(init.headers)
      headers.set(SESSION_HEADER, token)
      // JSON bodies only: a FormData upload sets its own multipart boundary.
      if (typeof init.body === 'string') headers.set('Content-Type', 'application/json')
      return fetch(`${apiBase}${path}`, { ...init, headers })
    }
    let response = await send(false)
    if (response.status === 401) {
      const body = await readJson(response.clone())
      if (body.code && SESSION_ERRORS.has(body.code)) response = await send(true)
    }
    const body = await readJson<T>(response)
    if (!response.ok) throw toError(response, body)
    return body
  }

  return {
    apiBase,
    /** Business name + which services are on. Cached for the session. */
    async info(): Promise<StsSessionInfo> {
      return (await ensureSession()).info
    },
    chat: {
      send(message: string): Promise<StsChatReply> {
        return request<StsChatReply>('/api/sdk/v1/chat', { method: 'POST', body: JSON.stringify({ message }) })
      },
      /**
       * Sends a document the chat asked for (PDF or photo, up to 10 MB) to the business's Google
       * Drive. `documentId` is the id from `services.chat.documentRequests`, when you know it.
       * Pass the returned `message` to `send()` so the assistant can confirm it arrived.
       */
      attach(file: File, documentId?: string): Promise<StsChatUpload> {
        const body = new FormData()
        body.append('file', file)
        if (documentId) body.append('documentId', documentId)
        return request<StsChatUpload>('/api/sdk/v1/chat/upload', { method: 'POST', body })
      },
    },
    speak: {
      /** LiveKit credentials for a new call. Use with `livekit-client` (the React hook does this for you). */
      connect(participantName?: string): Promise<StsSpeakConnection> {
        return request<StsSpeakConnection>('/api/sdk/v1/speak', {
          method: 'POST',
          body: JSON.stringify({ participantName }),
        })
      },
    },
    form: {
      async schema(): Promise<StsForm> {
        return (await request<{ form: StsForm }>('/api/sdk/v1/form')).form
      },
      async submit(values: Record<string, StsFormAnswer>, consent: boolean): Promise<string> {
        const body = await request<{ message: string }>('/api/sdk/v1/form', {
          method: 'POST',
          body: JSON.stringify({ values, consent }),
        })
        return body.message
      },
    },
    wizard: {
      async load(slug: string): Promise<StsWizard> {
        return (await request<{ wizard: StsWizard }>(`/api/sdk/v1/wizards/${encodeURIComponent(slug)}`)).wizard
      },
    },
    business: {
      async get(): Promise<StsBusiness> {
        return (await request<{ business: StsBusiness }>('/api/sdk/v1/business')).business
      },
      /** The business's own answers to what customers ask most, for an FAQ block. */
      async answers(): Promise<StsAnswer[]> {
        return (await request<{ answers: StsAnswer[] }>('/api/sdk/v1/answers')).answers
      },
      /** Reviews the business chose to show, newest first. */
      async reviews(): Promise<StsReview[]> {
        return (await request<{ reviews: StsReview[] }>('/api/sdk/v1/reviews')).reviews
      },
    },
  }
}

export type StsClient = ReturnType<typeof createSts>
