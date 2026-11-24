import { Prisma } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { decryptToken } from '@/lib/messages/encrypt'
import { isSyntheticFathomEmail, listFathomMeetings } from '@/lib/fathom/client'
import { ingestFathomMeetingForUser, purgeOwnerSelfLeads } from '@/lib/leads/ingestFathomMeeting'
import { scoreMeetingAndSave } from '@/lib/leads/scoreSummaryVsAgent'
import { resolveSerperApiKey, webResearchLead } from '@/lib/leads/webResearch'
import { projectFormByEmail, upsertLeadFromEmail } from '@/lib/leads/projectFormByEmail'
import { resolveUserGeminiApiKey } from '@/lib/leads/resolveUserLlmKey'
import { createBusinessLeadBatch, hasCronBatchToday } from '@/lib/leads/createBusinessLeadBatch'
import { canUseScrapeAgent } from '@/lib/leads/scrapeAgentSupervisor'
import {
  eventStartDate,
  googleOAuthClientMismatch,
  isGoogleInvalidGrantError,
  listSalesEvents,
  markGoogleCalendarConnectionRevoked,
  pickAttendeeEmail,
  refreshGoogleAccessToken,
  resolveGoogleOAuthCredentials,
} from '@/lib/leads/googleCalendar'

/**
 * The daily lead jobs for one creator, run by trigger.dev (src/trigger/leadIntel.ts): calendar
 * events become leads with briefs, recent Fathom meetings are pulled in, meetings get scored and
 * leads get researched. Kept free of Next.js-only imports so the trigger.dev worker can run it.
 */

const MAX_RESEARCH_PER_USER = 15
const MAX_SCORES_PER_USER = 20

export type LeadIntelSummary = {
  briefs: number
  meetingsSynced: number
  scores: number
  research: number
  errors: string[]
}

function emptySummary(): LeadIntelSummary {
  return { briefs: 0, meetingsSynced: 0, scores: 0, research: 0, errors: [] }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : 'fail'
}

function dayBounds(base = new Date()) {
  const start = new Date(base)
  start.setHours(0, 0, 0, 0)
  const end = new Date(base)
  end.setHours(23, 59, 59, 999)
  const forDate = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()))
  return { start, end, forDate }
}

/** Creators with an active Fathom or Google Calendar connection and Call Intel settings. */
export async function listLeadIntelCreators(): Promise<string[]> {
  const connections = await prismaClient.callIntelConnection.findMany({
    where: { status: 'ACTIVE' },
    select: { userId: true },
    distinct: ['userId'],
  })
  if (connections.length === 0) return []
  const withSettings = await prismaClient.callIntelSettings.findMany({
    where: { userId: { in: connections.map((connection) => connection.userId) } },
    select: { userId: true },
  })
  return withSettings.map((settings) => settings.userId)
}

/** Runs every daily lead job for one creator. Errors are collected, not thrown, so one failing
 *  provider never stops the others. */
export async function runLeadIntelForCreator(userId: string, now = new Date()): Promise<LeadIntelSummary> {
  const summary = emptySummary()
  const [user, settings, connections] = await Promise.all([
    prismaClient.user.findUnique({ where: { id: userId }, select: { email: true } }),
    prismaClient.callIntelSettings.findUnique({ where: { userId } }),
    prismaClient.callIntelConnection.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { provider: true, credentials: true, metadata: true },
    }),
  ])
  if (!user || !settings) return summary

  const fathom = connections.find((connection) => connection.provider === 'FATHOM')
  const gcal = connections.find((connection) => connection.provider === 'GOOGLE_CALENDAR')
  const geminiApiKey = await resolveUserGeminiApiKey(userId)
  const research = { used: 0 }

  if (gcal?.credentials) {
    await syncCalendarBriefs({ userId, ownerEmail: user.email, settings, gcal, geminiApiKey, research, summary, now })
  }
  if (fathom?.credentials) {
    await syncRecentFathomMeetings({ userId, ownerEmail: user.email, fathom, geminiApiKey, summary })
  }

  // Leads with meetings need an agent before their meetings can be scored.
  if (settings.defaultAgentId) {
    await prismaClient.callIntelLead.updateMany({
      where: { userId, selectedAgentId: null, meetings: { some: {} } },
      data: { selectedAgentId: settings.defaultAgentId },
    })
  }

  if (geminiApiKey) {
    await scoreUnscoredMeetings({ userId, geminiApiKey, summary })
    await researchLeadsWithMeetings({ userId, geminiApiKey, research, summary })
  }
  return summary
}

type CallIntelSettingsRow = NonNullable<Awaited<ReturnType<typeof prismaClient.callIntelSettings.findUnique>>>
type ConnectionRow = { provider: string; credentials: Prisma.JsonValue; metadata: Prisma.JsonValue }

/** Today's calendar events become leads, each with a brief (form answers + research). */
async function syncCalendarBriefs(input: {
  userId: string
  ownerEmail: string
  settings: CallIntelSettingsRow
  gcal: ConnectionRow
  geminiApiKey: string | null
  research: { used: number }
  summary: LeadIntelSummary
  now: Date
}) {
  const { userId, ownerEmail, settings, gcal, geminiApiKey, research, summary } = input
  const refresh = decryptToken((gcal.credentials as { refreshToken?: string }).refreshToken)
  if (!refresh) return
  const { start, end, forDate } = dayBounds(input.now)
  const webinarIds = settings.selectedWebinarIds || []

  try {
    const oauth = await resolveGoogleOAuthCredentials(userId)
    if (!oauth) throw new Error('Google OAuth credentials missing')
    if (googleOAuthClientMismatch(gcal, oauth.clientId)) {
      await markGoogleCalendarConnectionRevoked(userId, 'oauth_client_changed')
      throw new Error('Google OAuth client changed; reconnect required')
    }
    const tokens = await refreshGoogleAccessToken({
      refreshToken: refresh,
      clientId: oauth.clientId,
      clientSecret: oauth.clientSecret,
    })
    const events = await listSalesEvents({
      accessToken: tokens.access_token,
      timeMin: start,
      timeMax: end,
      filterMode: settings.calendarFilterMode === 'KEYWORD' ? 'KEYWORD' : 'ALL',
      filterKeyword: settings.calendarKeyword,
    })

    for (const event of events) {
      const attendee = pickAttendeeEmail(event, ownerEmail)
      if (!attendee) continue
      const lead = await upsertLeadFromEmail({
        userId,
        email: attendee.email,
        name: attendee.name,
        lastAppointmentAt: eventStartDate(event),
      })
      if (!lead.selectedAgentId && settings.defaultAgentId) {
        await prismaClient.callIntelLead.update({
          where: { id: lead.id },
          data: { selectedAgentId: settings.defaultAgentId },
        })
      }

      const form = await projectFormByEmail(userId, attendee.email, webinarIds)
      let researchSnapshot: Prisma.InputJsonValue | undefined
      if (research.used < MAX_RESEARCH_PER_USER && geminiApiKey) {
        try {
          const dossier = await webResearchLead({
            name: lead.name,
            email: lead.email,
            company: lead.company,
            userId,
            geminiApiKey,
          })
          researchSnapshot = dossier as unknown as Prisma.InputJsonValue
          await prismaClient.callIntelLead.update({ where: { id: lead.id }, data: { webResearchJson: researchSnapshot } })
          research.used++
          summary.research++
        } catch (err) {
          summary.errors.push(`research ${lead.email}: ${message(err)}`)
        }
      }

      const brief = {
        formSnapshot: (form || null) as Prisma.InputJsonValue,
        researchSnapshot: researchSnapshot || undefined,
        status: 'READY' as const,
      }
      await prismaClient.callIntelBrief.upsert({
        where: { leadId_forDate_calendarEventId: { leadId: lead.id, forDate, calendarEventId: event.id } },
        create: { leadId: lead.id, forDate, calendarEventId: event.id, ...brief },
        update: brief,
      })
      summary.briefs++
    }
  } catch (err) {
    if (isGoogleInvalidGrantError(err)) {
      await markGoogleCalendarConnectionRevoked(userId, 'invalid_grant', err instanceof Error ? err.message : String(err))
    }
    summary.errors.push(`gcal ${userId}: ${message(err)}`)
  }
}

/** Catches Fathom meetings from the last 3 days that a webhook may have missed. */
async function syncRecentFathomMeetings(input: {
  userId: string
  ownerEmail: string
  fathom: ConnectionRow
  geminiApiKey: string | null
  summary: LeadIntelSummary
}) {
  const { userId, ownerEmail, fathom, geminiApiKey, summary } = input
  const apiKey = decryptToken((fathom.credentials as { apiKey?: string }).apiKey)
  if (!apiKey) return
  try {
    const after = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    const meetings = await listFathomMeetings(apiKey, { limit: 25, created_after: after.toISOString() })
    const ownerEmails = new Set<string>()
    if (ownerEmail) ownerEmails.add(ownerEmail.toLowerCase())
    const ownerNames: string[] = []
    for (const meeting of meetings) {
      if (meeting.recorded_by?.email) ownerEmails.add(meeting.recorded_by.email.toLowerCase())
      if (meeting.recorded_by?.name?.trim()) ownerNames.push(meeting.recorded_by.name.trim())
      await ingestFathomMeetingForUser({ userId, ownerEmail, meeting, autoScore: true, geminiApiKey })
      summary.meetingsSynced++
    }
    await purgeOwnerSelfLeads({ userId, ownerEmails: [...ownerEmails], ownerNames })
  } catch (err) {
    summary.errors.push(`fathom ${userId}: ${message(err)}`)
  }
}

/** Scores meetings that have a lead and a summary but no score yet. */
async function scoreUnscoredMeetings(input: { userId: string; geminiApiKey: string; summary: LeadIntelSummary }) {
  const { userId, geminiApiKey, summary } = input
  const unscored = await prismaClient.callIntelMeeting.findMany({
    where: { userId, summary: { not: null }, leadId: { not: null }, scores: { none: {} } },
    select: { id: true },
    take: MAX_SCORES_PER_USER,
  })
  for (const meeting of unscored) {
    try {
      await scoreMeetingAndSave({ meetingId: meeting.id, apiKey: geminiApiKey })
      summary.scores++
    } catch (err) {
      summary.errors.push(`score ${meeting.id}: ${message(err)}`)
    }
  }
}

/** Researches leads that came in through meetings (Fathom-only, Instant) and have no dossier. */
async function researchLeadsWithMeetings(input: {
  userId: string
  geminiApiKey: string
  research: { used: number }
  summary: LeadIntelSummary
}) {
  const { userId, geminiApiKey, research, summary } = input
  if (research.used >= MAX_RESEARCH_PER_USER) return
  const candidates = await prismaClient.callIntelLead.findMany({
    where: { userId, meetings: { some: {} } },
    orderBy: { lastAppointmentAt: 'desc' },
    take: 40,
    select: { id: true, name: true, email: true, company: true, webResearchJson: true },
  })
  const needsResearch = candidates
    .filter((lead) => lead.webResearchJson == null)
    .slice(0, MAX_RESEARCH_PER_USER - research.used)

  for (const lead of needsResearch) {
    try {
      const dossier = await webResearchLead({
        name: lead.name,
        email: isSyntheticFathomEmail(lead.email) ? '' : lead.email,
        company: lead.company,
        userId,
        geminiApiKey,
      })
      await prismaClient.callIntelLead.update({
        where: { id: lead.id },
        data: { webResearchJson: dossier as unknown as Prisma.InputJsonValue },
      })
      research.used++
      summary.research++
    } catch (err) {
      summary.errors.push(`research-meeting ${lead.email}: ${message(err)}`)
    }
  }
}

export type MapsBatchCreator = {
  userId: string
  location: string
  niche: string
  defaultAgentId: string | null
}

/** Creators who set a business niche and location for the daily Google Maps lead batch. */
export async function listMapsBatchCreators(): Promise<MapsBatchCreator[]> {
  const rows = await prismaClient.callIntelSettings.findMany({
    where: { businessLocation: { not: null }, businessNiche: { not: null } },
    select: { userId: true, businessLocation: true, businessNiche: true, defaultAgentId: true },
  })
  return rows.flatMap((row) => {
    const location = row.businessLocation?.trim() || ''
    const niche = row.businessNiche?.trim() || ''
    return location && niche ? [{ userId: row.userId, location, niche, defaultAgentId: row.defaultAgentId }] : []
  })
}

export type MapsBatchResult =
  | { status: 'skipped'; reason: 'already-ran-today' | 'no-serper-key' }
  | { status: 'done'; leads: number; scraped: number; scrapeAgent: boolean }

/** Ten new businesses from Google Maps for one creator, with their websites scraped. */
export async function runMapsBatchForCreator(creator: MapsBatchCreator): Promise<MapsBatchResult> {
  if (await hasCronBatchToday(creator.userId)) return { status: 'skipped', reason: 'already-ran-today' }
  const apiKey = await resolveSerperApiKey(creator.userId)
  if (!apiKey) return { status: 'skipped', reason: 'no-serper-key' }
  const batch = await createBusinessLeadBatch({
    userId: creator.userId,
    location: creator.location,
    niche: creator.niche,
    apiKey,
    source: 'CRON',
    defaultAgentId: creator.defaultAgentId,
    scrape: true,
  })
  return { status: 'done', leads: batch.count, scraped: batch.scraped, scrapeAgent: canUseScrapeAgent() }
}
