/**
 * Fathom.video API client (summary-first).
 * Shapes inspired by https://github.com/matthewbergvinson/fathom-mcp
 * and https://developers.fathom.ai/api-reference/meetings/list-meetings
 */

const FATHOM_API_BASE = 'https://api.fathom.ai/external/v1'

export type FathomParticipant = {
  name?: string
  email?: string
  is_external?: boolean
}

export type FathomActionItem = {
  description?: string
  completed?: boolean
  assignee?: { name?: string; email?: string }
}

export type FathomTranscriptSpeaker = {
  display_name?: string
  matched_calendar_invitee_email?: string | null
}

export type FathomTranscriptItem = {
  speaker?: FathomTranscriptSpeaker
  text?: string
  timestamp?: string
}

export type FathomMeeting = {
  recording_id: number | string
  title?: string
  url?: string
  share_url?: string
  created_at?: string
  recording_start_time?: string
  duration_seconds?: number
  calendar_invitees?: FathomParticipant[]
  participants?: FathomParticipant[]
  recorded_by?: { name?: string; email?: string }
  /** Legacy / alternate shape */
  summary?: string | { markdown?: string; text?: string; template_name?: string }
  /** Current Fathom API field when include_summary=true */
  default_summary?: {
    template_name?: string | null
    markdown_formatted?: string | null
  } | null
  action_items?: FathomActionItem[]
  transcript?: FathomTranscriptItem[] | unknown
}

export type FathomLeadIdentity = {
  email: string
  name: string
  /** True when email is a local placeholder (instant Meet, no guest email) */
  emailIsSynthetic: boolean
}

type ListMeetingsParams = {
  limit?: number
  created_after?: string
  created_before?: string
}

async function fathomFetch<T>(
  apiKey: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${FATHOM_API_BASE}${path}`, {
    ...init,
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers || {}),
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Fathom API ${res.status}: ${body.slice(0, 300)}`)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

function extractSummary(meeting: FathomMeeting): string | null {
  const fromDefault = meeting.default_summary?.markdown_formatted?.trim()
  if (fromDefault) return cleanFathomSummaryText(fromDefault)

  const s = meeting.summary
  if (!s) return null
  if (typeof s === 'string') {
    const t = s.trim()
    return t ? cleanFathomSummaryText(t) : null
  }
  if (typeof s === 'object') {
    const text = s.markdown || s.text
    const t = text?.trim()
    return t ? cleanFathomSummaryText(t) : null
  }
  return null
}

/**
 * Strip Fathom deep-link timestamps so summaries stay human-readable.
 * e.g. (https://fathom.video/share/...?timestamp=229.0) or [text](https://fathom.video/...)
 */
export function cleanFathomSummaryText(input: string): string {
  let text = input

  // Markdown links → keep visible label only
  text = text.replace(
    /\[([^\]]*)\]\(\s*https?:\/\/(?:www\.)?fathom\.video\/[^)]+\)/gi,
    '$1',
  )

  // Bare share URLs, often wrapped in parentheses
  text = text.replace(
    /\(?\s*https?:\/\/(?:www\.)?fathom\.video\/[^\s)]+\)?/gi,
    '',
  )

  // Leftover empty parens / brackets from stripping
  text = text.replace(/\(\s*\)/g, '')
  text = text.replace(/\[\s*\]/g, '')

  // Tighten whitespace left by removals
  text = text.replace(/[^\S\n]{2,}/g, ' ')
  text = text.replace(/ *\n[ \t]+/g, '\n')
  text = text.replace(/\n{3,}/g, '\n\n')

  return text.trim()
}

function collectParticipants(meeting: FathomMeeting): FathomParticipant[] {
  const list = [
    ...(meeting.participants || []),
    ...(meeting.calendar_invitees || []),
  ]
  const seen = new Set<string>()
  const out: FathomParticipant[] = []
  for (const p of list) {
    const key = (p.email || p.name || '').toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }

  // Add transcript speakers (often have names but no email on instant Meets)
  if (Array.isArray(meeting.transcript)) {
    for (const item of meeting.transcript) {
      const name = item.speaker?.display_name?.trim()
      const email = item.speaker?.matched_calendar_invitee_email?.trim()
      if (!name && !email) continue
      const key = (email || name || '').toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push({
        name: name || undefined,
        email: email || undefined,
        is_external: email
          ? undefined
          : true /* name-only speakers treated as external candidates */,
      })
    }
  }

  return out
}

/** Placeholder email so name-only instant-Meet leads still fit @@unique([userId, email]). */
export function syntheticLeadEmail(name: string): string {
  const slug =
    name
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'unknown-lead'
  return `${slug}@fathom.local`
}

export function isSyntheticFathomEmail(email: string | null | undefined): boolean {
  return Boolean(email?.toLowerCase().endsWith('@fathom.local'))
}

function normalizePersonKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function emailLocalPart(email: string): string {
  return email.split('@')[0]?.toLowerCase() || ''
}

/**
 * Owner / host detection must be fuzzy: Fathom speaker labels often differ from
 * recorded_by.name (e.g. "itsmrapon" vs "Apon Rahman") while still being the host.
 */
export function isFathomOwnerIdentity(
  candidate: { email?: string | null; name?: string | null },
  ownerEmails: string[] = [],
  ownerNames: string[] = [],
): boolean {
  const owners = new Set(
    ownerEmails.map((e) => e.trim().toLowerCase()).filter(Boolean),
  )
  const ownerNameKeys = ownerNames
    .map(normalizePersonKey)
    .filter(Boolean)
  const ownerLocals = [...owners].map(emailLocalPart).filter(Boolean)

  const email = candidate.email?.trim().toLowerCase()
  if (email && owners.has(email)) return true

  const nameKey = candidate.name ? normalizePersonKey(candidate.name) : ''
  if (!nameKey) return false

  for (const ownerName of ownerNameKeys) {
    if (!ownerName) continue
    if (nameKey === ownerName) return true
    if (nameKey.includes(ownerName) || ownerName.includes(nameKey)) return true
    // Token overlap (at least one meaningful token ≥3 chars)
    const a = new Set(nameKey.split(' ').filter((t) => t.length >= 3))
    const b = ownerName.split(' ').filter((t) => t.length >= 3)
    if (b.some((t) => a.has(t))) return true
  }

  // Speaker "itsmrapon" vs email itsmrapon@gmail.com
  for (const local of ownerLocals) {
    const localKey = normalizePersonKey(local.replace(/[._]/g, ' '))
    const compactLocal = local.replace(/[^a-z0-9]/g, '')
    const compactName = nameKey.replace(/\s+/g, '')
    if (compactLocal && compactName && compactLocal === compactName) return true
    if (localKey && (nameKey === localKey || nameKey.includes(localKey) || localKey.includes(nameKey))) {
      return true
    }
  }

  return false
}

function collectUniqueSpeakers(
  meeting: FathomMeeting,
): FathomTranscriptSpeaker[] {
  const speakers: FathomTranscriptSpeaker[] = []
  if (!Array.isArray(meeting.transcript)) return speakers
  const seen = new Set<string>()
  for (const item of meeting.transcript) {
    const name = item.speaker?.display_name?.trim()
    const email = item.speaker?.matched_calendar_invitee_email?.trim()
    const key = `${(email || '').toLowerCase()}|${(name || '').toLowerCase()}`
    if (!name && !email) continue
    if (seen.has(key)) continue
    seen.add(key)
    speakers.push({
      display_name: name,
      matched_calendar_invitee_email: email || null,
    })
  }
  return speakers
}

/**
 * Resolve who the lead is for a Fathom meeting.
 * Never returns the host/owner — prefers external invitee email, then guest
 * speaker email, then first non-owner speaker name (synthetic email).
 */
export function resolveFathomLeadIdentity(
  meeting: FathomMeeting,
  ownerEmails: string[] = [],
): FathomLeadIdentity | null {
  const owners = [
    ...ownerEmails,
    meeting.recorded_by?.email || '',
  ]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  const ownerNames = [meeting.recorded_by?.name].filter(
    (n): n is string => Boolean(n?.trim()),
  )

  const invitees = [
    ...(meeting.calendar_invitees || []),
    ...(meeting.participants || []),
  ]

  const isOwner = (p: { email?: string | null; name?: string | null }) =>
    isFathomOwnerIdentity(p, owners, ownerNames)

  // 1) Explicit external invitees with a real email (never the host)
  const externalWithEmail = invitees.find(
    (p) =>
      p.email &&
      p.is_external === true &&
      !isOwner({ email: p.email, name: p.name }),
  )
  if (externalWithEmail?.email) {
    return {
      email: externalWithEmail.email.toLowerCase(),
      name: externalWithEmail.name?.trim() || externalWithEmail.email,
      emailIsSynthetic: false,
    }
  }

  // 2) Any non-owner invitee/participant with email
  const nonOwnerInvitee = invitees.find(
    (p) => p.email && !isOwner({ email: p.email, name: p.name }),
  )
  if (nonOwnerInvitee?.email) {
    return {
      email: nonOwnerInvitee.email.toLowerCase(),
      name: nonOwnerInvitee.name?.trim() || nonOwnerInvitee.email,
      emailIsSynthetic: false,
    }
  }

  const speakers = collectUniqueSpeakers(meeting)

  // 3) Transcript speaker matched to a non-owner calendar email
  for (const s of speakers) {
    const email = s.matched_calendar_invitee_email?.toLowerCase() || null
    const name = s.display_name || null
    if (!email) continue
    if (isOwner({ email, name })) continue
    return {
      email,
      name: name?.trim() || email,
      emailIsSynthetic: false,
    }
  }

  // 4) First non-owner speaker name → synthetic email (instant Meet)
  for (const s of speakers) {
    const name = s.display_name?.trim()
    if (!name) continue
    const email = s.matched_calendar_invitee_email || null
    if (isOwner({ email, name })) continue
    return {
      email: syntheticLeadEmail(name),
      name,
      emailIsSynthetic: true,
    }
  }

  // 5) Named invitee without email who isn't the owner
  for (const p of invitees) {
    const name = p.name?.trim()
    if (!name) continue
    if (isOwner({ email: p.email, name })) continue
    if (p.email) {
      return {
        email: p.email.toLowerCase(),
        name,
        emailIsSynthetic: false,
      }
    }
    return {
      email: syntheticLeadEmail(name),
      name,
      emailIsSynthetic: true,
    }
  }

  // Do NOT fall back to the owner — better no lead than a self-lead
  return null
}

export function normalizeFathomMeeting(meeting: FathomMeeting) {
  const recordingId = String(meeting.recording_id)
  const recordedAt = new Date(
    meeting.recording_start_time || meeting.created_at || Date.now(),
  )
  return {
    fathomRecordingId: recordingId,
    summary: extractSummary(meeting),
    actionItems: meeting.action_items || [],
    participants: collectParticipants(meeting),
    recordedAt,
    duration:
      typeof meeting.duration_seconds === 'number'
        ? Math.round(meeting.duration_seconds)
        : null,
    fathomUrl: meeting.share_url || meeting.url || null,
  }
}

export async function listFathomMeetings(
  apiKey: string,
  params: ListMeetingsParams = {},
): Promise<FathomMeeting[]> {
  const qs = new URLSearchParams()
  if (params.limit != null) qs.set('limit', String(params.limit))
  if (params.created_after) qs.set('created_after', params.created_after)
  if (params.created_before) qs.set('created_before', params.created_before)
  // Required to receive default_summary.markdown_formatted
  qs.set('include_summary', 'true')
  qs.set('include_action_items', 'true')
  // Speakers → name-only leads for instant Meets
  qs.set('include_transcript', 'true')
  const q = qs.toString()
  const data = await fathomFetch<{ items?: FathomMeeting[] } | FathomMeeting[]>(
    apiKey,
    `/meetings${q ? `?${q}` : ''}`,
  )
  if (Array.isArray(data)) return data
  return data.items || []
}

export async function getFathomMeeting(
  apiKey: string,
  recordingId: string | number,
  opts?: { include_transcript?: boolean },
): Promise<FathomMeeting> {
  const qs = new URLSearchParams({
    include_summary: 'true',
    include_action_items: 'true',
    include_transcript: opts?.include_transcript === false ? 'false' : 'true',
  })
  try {
    return await fathomFetch<FathomMeeting>(
      apiKey,
      `/recordings/${recordingId}?${qs.toString()}`,
    )
  } catch {
    const meetings = await listFathomMeetings(apiKey, { limit: 50 })
    const match = meetings.find(
      (m) => String(m.recording_id) === String(recordingId),
    )
    if (match) return match
    throw new Error(`Fathom recording ${recordingId} not found`)
  }
}

/** Alternate path used by some Fathom API versions */
export async function getFathomRecording(
  apiKey: string,
  recordingId: string | number,
): Promise<FathomMeeting> {
  return getFathomMeeting(apiKey, recordingId)
}

export async function createFathomWebhook(
  apiKey: string,
  destinationUrl: string,
  includeSummary = true,
): Promise<{ id?: string; secret?: string; [key: string]: unknown }> {
  return fathomFetch(apiKey, '/webhooks', {
    method: 'POST',
    body: JSON.stringify({
      destination_url: destinationUrl,
      include_transcript: true,
      include_summary: includeSummary,
      include_action_items: true,
      include_crm_matches: false,
      triggered_for: ['my_recordings', 'shared_external_recordings'],
    }),
  })
}

export async function deleteFathomWebhook(
  apiKey: string,
  webhookId: string,
): Promise<void> {
  await fathomFetch(apiKey, `/webhooks/${webhookId}`, { method: 'DELETE' })
}

/** Flatten Fathom transcript items for LLM context (speaker-labeled lines). */
export function formatFathomTranscript(
  transcript: FathomTranscriptItem[] | unknown,
  maxChars = 120_000,
): string {
  if (!Array.isArray(transcript)) return ''
  const lines = transcript
    .map((item) => {
      const speaker = item.speaker?.display_name?.trim() || 'Speaker'
      const text = item.text?.trim() || ''
      if (!text) return ''
      const ts = item.timestamp ? `[${item.timestamp}] ` : ''
      return `${ts}${speaker}: ${text}`
    })
    .filter(Boolean)
  let result = lines.join('\n')
  if (result.length > maxChars) {
    result = `${result.slice(0, maxChars)}\n...[transcript truncated]`
  }
  return result
}

export function pickExternalEmail(
  participants: FathomParticipant[],
  ownerEmails: string[] = [],
): string | null {
  const external = participants.find(
    (p) =>
      p.email &&
      p.is_external === true &&
      !isFathomOwnerIdentity({ email: p.email, name: p.name }, ownerEmails),
  )
  if (external?.email) return external.email.toLowerCase()
  const nonOwner = participants.find(
    (p) =>
      p.email &&
      !isFathomOwnerIdentity({ email: p.email, name: p.name }, ownerEmails),
  )
  return nonOwner?.email?.toLowerCase() || null
}

export function pickLeadName(
  participants: FathomParticipant[],
  email: string | null,
): string {
  if (email) {
    const match = participants.find(
      (p) => p.email?.toLowerCase() === email.toLowerCase(),
    )
    if (match?.name) return match.name
  }
  const named = participants.find((p) => p.name)
  return named?.name || email || 'Unknown lead'
}
