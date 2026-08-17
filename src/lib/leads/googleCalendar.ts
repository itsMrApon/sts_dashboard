import { Prisma } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { decryptToken } from '@/lib/messages/encrypt'

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

export const SALES_EVENT_TAG = '[Sales]'

export type CalendarFilterMode = 'ALL' | 'KEYWORD'

export type GoogleCalendarEvent = {
  id: string
  summary?: string
  description?: string
  htmlLink?: string
  start?: { dateTime?: string; date?: string; timeZone?: string }
  end?: { dateTime?: string; date?: string }
  attendees?: Array<{ email?: string; displayName?: string; self?: boolean }>
}

export type GoogleOAuthAppCredentials = {
  clientId: string
  clientSecret: string
  source: 'user' | 'env'
}

export async function resolveGoogleOAuthCredentials(
  userId?: string | null,
): Promise<GoogleOAuthAppCredentials | null> {
  if (userId) {
    const settings = await prismaClient.callIntelSettings.findUnique({
      where: { userId },
      select: { googleClientIdEnc: true, googleClientSecretEnc: true },
    })
    const clientId = decryptToken(settings?.googleClientIdEnc)
    const clientSecret = decryptToken(settings?.googleClientSecretEnc)
    if (clientId?.trim() && clientSecret?.trim()) {
      return { clientId: clientId.trim(), clientSecret: clientSecret.trim(), source: 'user' }
    }
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  if (clientId && clientSecret) {
    return { clientId, clientSecret, source: 'env' }
  }
  return null
}

export function getGoogleCalendarRedirectUri(origin: string) {
  return (
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    `${origin.replace(/\/$/, '')}/api/integrations/google-calendar/callback`
  )
}

export function buildGoogleCalendarAuthUrl(options: {
  origin: string
  state: string
  clientId: string
}) {
  const redirectUri = getGoogleCalendarRedirectUri(options.origin)
  const params = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
    state: options.state,
  })
  return `${GOOGLE_AUTH}?${params.toString()}`
}

export async function exchangeGoogleCode(options: {
  code: string
  origin: string
  clientId: string
  clientSecret: string
}) {
  const redirectUri = getGoogleCalendarRedirectUri(options.origin)
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: options.code,
      client_id: options.clientId,
      client_secret: options.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google token exchange failed: ${text.slice(0, 300)}`)
  }
  return (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
    token_type: string
  }
}

export class GoogleTokenRefreshError extends Error {
  readonly revoked: boolean

  constructor(message: string, revoked = false) {
    super(message)
    this.name = 'GoogleTokenRefreshError'
    this.revoked = revoked
  }
}

export function isGoogleInvalidGrantError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return /invalid_grant|token has been expired or revoked/i.test(message)
}

export async function refreshGoogleAccessToken(options: {
  refreshToken: string
  clientId: string
  clientSecret: string
}) {
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: options.clientId,
      client_secret: options.clientSecret,
      refresh_token: options.refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    const revoked = /invalid_grant|expired or revoked/i.test(text)
    throw new GoogleTokenRefreshError(
      `Google refresh failed: ${text.slice(0, 300)}`,
      revoked,
    )
  }
  return (await res.json()) as {
    access_token: string
    expires_in: number
  }
}

export type GoogleCalendarRevokeReason =
  | 'invalid_grant'
  | 'oauth_client_changed'
  | 'missing_refresh'

/**
 * Mark Calendar OAuth as needing reconnect.
 * Keeps encrypted refresh token when the OAuth *app* client changed so a
 * mistaken Save in Settings does not permanently destroy the prior token
 * until the user intentionally reconnects (new token overwrites).
 */
export async function markGoogleCalendarConnectionRevoked(
  userId: string,
  reason: GoogleCalendarRevokeReason = 'invalid_grant',
): Promise<void> {
  const existing = await prismaClient.callIntelConnection.findUnique({
    where: {
      userId_provider: { userId, provider: 'GOOGLE_CALENDAR' },
    },
  })
  if (!existing) return

  const clearCredentials =
    reason === 'invalid_grant' || reason === 'missing_refresh'

  await prismaClient.callIntelConnection.update({
    where: { id: existing.id },
    data: {
      status: 'ERROR',
      ...(clearCredentials ? { credentials: Prisma.DbNull } : {}),
      metadata: {
        ...((existing.metadata as Record<string, unknown> | null) || {}),
        revokedAt: new Date().toISOString(),
        lastError: reason,
      },
    },
  })
}

export function getStoredGoogleOAuthClientId(
  conn: { metadata?: unknown } | null | undefined,
): string | null {
  const meta = conn?.metadata as { oauthClientId?: string } | null
  const id = meta?.oauthClientId?.trim()
  return id || null
}

/**
 * Refresh tokens are bound to the OAuth client that issued them.
 * If Settings later saves a different Client ID (or switches env↔user),
 * Google returns invalid_grant and we used to wipe the connection on every
 * /lead load — that looked like "must reconnect constantly".
 */
export function googleOAuthClientMismatch(
  conn: { metadata?: unknown } | null | undefined,
  currentClientId: string | null | undefined,
): boolean {
  const stored = getStoredGoogleOAuthClientId(conn)
  if (!stored || !currentClientId?.trim()) return false
  return stored !== currentClientId.trim()
}

export function googleCalendarNeedsReconnect(
  conn: { status: string; credentials?: unknown; metadata?: unknown } | null | undefined,
  refreshToken: string | null | undefined,
  currentClientId?: string | null,
): boolean {
  if (!conn) return false
  if (conn.status === 'ERROR') return true
  if (conn.status !== 'ACTIVE') return false
  if (googleOAuthClientMismatch(conn, currentClientId)) return true
  // If credentials weren't loaded, trust ACTIVE status (avoid false positives).
  if (conn.credentials === undefined) return false
  return !refreshToken?.trim()
}

export function matchesCalendarFilter(
  event: GoogleCalendarEvent,
  mode: CalendarFilterMode = 'ALL',
  keyword?: string | null,
): boolean {
  if (mode === 'ALL') return true
  const needle = (keyword || SALES_EVENT_TAG).trim().toLowerCase()
  if (!needle) return true
  const hay = `${event.summary || ''} ${event.description || ''}`.toLowerCase()
  return hay.includes(needle)
}

/** @deprecated use matchesCalendarFilter */
export function isSalesTaggedEvent(event: GoogleCalendarEvent): boolean {
  return matchesCalendarFilter(event, 'KEYWORD', SALES_EVENT_TAG)
}

export async function listSalesEvents(options: {
  accessToken: string
  timeMin: Date
  timeMax: Date
  calendarId?: string
  filterMode?: CalendarFilterMode
  filterKeyword?: string | null
}): Promise<GoogleCalendarEvent[]> {
  const calendarId = encodeURIComponent(options.calendarId || 'primary')
  const qs = new URLSearchParams({
    timeMin: options.timeMin.toISOString(),
    timeMax: options.timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  })
  const res = await fetch(
    `${CALENDAR_API}/calendars/${calendarId}/events?${qs.toString()}`,
    {
      headers: { Authorization: `Bearer ${options.accessToken}` },
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Calendar list failed: ${text.slice(0, 300)}`)
  }
  const data = (await res.json()) as { items?: GoogleCalendarEvent[] }
  const mode = options.filterMode || 'ALL'
  return (data.items || []).filter((ev) =>
    matchesCalendarFilter(ev, mode, options.filterKeyword),
  )
}

export function eventStartDate(event: GoogleCalendarEvent): Date | null {
  const raw = event.start?.dateTime || event.start?.date
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

export function pickAttendeeEmail(
  event: GoogleCalendarEvent,
  ownerEmail?: string | null,
): { email: string; name: string } | null {
  const attendees = event.attendees || []
  const external = attendees.find(
    (a) =>
      a.email &&
      !a.self &&
      (!ownerEmail || a.email.toLowerCase() !== ownerEmail.toLowerCase()),
  )
  if (external?.email) {
    return {
      email: external.email.toLowerCase(),
      name: external.displayName || external.email,
    }
  }
  const m = (event.summary || '').match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  )
  if (m) {
    return { email: m[0].toLowerCase(), name: event.summary || m[0] }
  }
  return null
}

export type CreateGoogleMeetEventResult = {
  eventId: string
  htmlLink: string | null
  meetLink: string | null
  start: string
  end: string
}

/**
 * Create a Google Calendar event with a Google Meet conference.
 * Requires calendar.events scope (reconnect Google if previously readonly-only).
 */
export async function createGoogleMeetEvent(options: {
  accessToken: string
  summary: string
  description?: string
  start: Date
  end: Date
  attendeeEmail?: string | null
  calendarId?: string
}): Promise<CreateGoogleMeetEventResult> {
  const calendarId = encodeURIComponent(options.calendarId || 'primary')
  const requestId = `sts-meet-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const body: Record<string, unknown> = {
    summary: options.summary,
    description: options.description || undefined,
    start: { dateTime: options.start.toISOString() },
    end: { dateTime: options.end.toISOString() },
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  }
  if (options.attendeeEmail?.trim()) {
    body.attendees = [{ email: options.attendeeEmail.trim() }]
  }

  const res = await fetch(
    `${CALENDAR_API}/calendars/${calendarId}/events?conferenceDataVersion=1`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Create Meet event failed: ${text.slice(0, 300)}`)
  }

  const data = (await res.json()) as {
    id?: string
    htmlLink?: string
    hangoutLink?: string
    conferenceData?: {
      entryPoints?: Array<{ entryPointType?: string; uri?: string }>
    }
    start?: { dateTime?: string }
    end?: { dateTime?: string }
  }

  const meetFromEntry =
    data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')
      ?.uri || null

  return {
    eventId: data.id || '',
    htmlLink: data.htmlLink || null,
    meetLink: data.hangoutLink || meetFromEntry,
    start: data.start?.dateTime || options.start.toISOString(),
    end: data.end?.dateTime || options.end.toISOString(),
  }
}
