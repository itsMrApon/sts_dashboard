import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { decryptToken } from '@/lib/messages/encrypt'
import { isSyntheticFathomEmail, listFathomMeetings } from '@/lib/fathom/client'
import { ingestFathomMeetingForUser, purgeOwnerSelfLeads } from '@/lib/leads/ingestFathomMeeting'
import { scoreMeetingAndSave } from '@/lib/leads/scoreSummaryVsAgent'
import { webResearchLead } from '@/lib/leads/webResearch'
import { projectFormByEmail, upsertLeadFromEmail } from '@/lib/leads/projectFormByEmail'
import { resolveUserGeminiApiKey } from '@/lib/leads/resolveUserLlmKey'
import {
  createBusinessLeadBatch,
  hasCronBatchToday,
} from '@/lib/leads/createBusinessLeadBatch'
import { resolveSerperApiKey } from '@/lib/leads/webResearch'
import { canUseScrapeAgent } from '@/lib/leads/scrapeAgentSupervisor'
import {
  listSalesEvents,
  pickAttendeeEmail,
  eventStartDate,
  refreshGoogleAccessToken,
  resolveGoogleOAuthCredentials,
  isGoogleInvalidGrantError,
  markGoogleCalendarConnectionRevoked,
  googleOAuthClientMismatch,
} from '@/lib/leads/googleCalendar'

export const runtime = 'nodejs'
export const maxDuration = 300

const MAX_RESEARCH_PER_USER = 15
const MAX_SCORES_PER_USER = 20

function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const header = req.headers.get('authorization') || ''
  return header === `Bearer ${secret}`
}

function dayBounds(base = new Date()) {
  const start = new Date(base)
  start.setHours(0, 0, 0, 0)
  const end = new Date(base)
  end.setHours(23, 59, 59, 999)
  const forDate = new Date(
    Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()),
  )
  return { start, end, forDate }
}

async function ensureDefaultAgent(
  leadId: string,
  selectedAgentId: string | null | undefined,
  defaultAgentId: string | null | undefined,
): Promise<string | null> {
  if (selectedAgentId) return selectedAgentId
  if (!defaultAgentId) return null
  await prismaClient.callIntelLead.update({
    where: { id: leadId },
    data: { selectedAgentId: defaultAgentId },
  })
  return defaultAgentId
}

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { start, end, forDate } = dayBounds()
  const connections = await prismaClient.callIntelConnection.findMany({
    where: { status: 'ACTIVE' },
    select: {
      userId: true,
      provider: true,
      credentials: true,
      metadata: true,
    },
  })

  const byUser = new Map<string, typeof connections>()
  for (const c of connections) {
    const list = byUser.get(c.userId) || []
    list.push(c)
    byUser.set(c.userId, list)
  }

  const summary = {
    users: byUser.size,
    briefs: 0,
    meetingsSynced: 0,
    scores: 0,
    research: 0,
    websiteScrapes: 0,
    businessBatches: 0,
    businessLeads: 0,
    errors: [] as string[],
  }

  for (const [userId, conns] of byUser) {
    const user = await prismaClient.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })
    if (!user) continue

    const fathom = conns.find((c) => c.provider === 'FATHOM')
    const gcal = conns.find((c) => c.provider === 'GOOGLE_CALENDAR')

    const settings = await prismaClient.callIntelSettings.findUnique({
      where: { userId },
    })
    // Wizard removed; process any user with Call Intel settings.

    const webinarIds = settings.selectedWebinarIds || []
    const geminiApiKey = await resolveUserGeminiApiKey(userId)
    let researchCount = 0

    // Calendar → leads + briefs + research
    if (gcal?.credentials) {
      const refresh = decryptToken(
        (gcal.credentials as { refreshToken?: string }).refreshToken,
      )
      if (refresh) {
        try {
          const oauth = await resolveGoogleOAuthCredentials(userId)
          if (!oauth) throw new Error('Google OAuth credentials missing')
          if (googleOAuthClientMismatch(gcal, oauth.clientId)) {
            await markGoogleCalendarConnectionRevoked(
              userId,
              'oauth_client_changed',
            )
            throw new Error('Google OAuth client changed; reconnect required')
          }
          const tokens = await refreshGoogleAccessToken({
            refreshToken: refresh,
            clientId: oauth.clientId,
            clientSecret: oauth.clientSecret,
          })
          const filterMode =
            settings.calendarFilterMode === 'KEYWORD' ? 'KEYWORD' : 'ALL'
          const events = await listSalesEvents({
            accessToken: tokens.access_token,
            timeMin: start,
            timeMax: end,
            filterMode,
            filterKeyword: settings.calendarKeyword,
          })

          for (const ev of events) {
            const attendee = pickAttendeeEmail(ev, user.email)
            if (!attendee) continue
            const startAt = eventStartDate(ev)
            const lead = await upsertLeadFromEmail({
              userId,
              email: attendee.email,
              name: attendee.name,
              lastAppointmentAt: startAt,
            })

            await ensureDefaultAgent(
              lead.id,
              lead.selectedAgentId,
              settings.defaultAgentId,
            )

            const form = await projectFormByEmail(
              userId,
              attendee.email,
              webinarIds,
            )
            let researchSnapshot: Prisma.InputJsonValue | undefined
            if (researchCount < MAX_RESEARCH_PER_USER && geminiApiKey) {
              try {
                const dossier = await webResearchLead({
                  name: lead.name,
                  email: lead.email,
                  company: lead.company,
                  userId,
                  geminiApiKey,
                })
                researchSnapshot = dossier as unknown as Prisma.InputJsonValue
                await prismaClient.callIntelLead.update({
                  where: { id: lead.id },
                  data: { webResearchJson: researchSnapshot },
                })
                researchCount++
                summary.research++
              } catch (err) {
                summary.errors.push(
                  `research ${lead.email}: ${err instanceof Error ? err.message : 'fail'}`,
                )
              }
            }

            await prismaClient.callIntelBrief.upsert({
              where: {
                leadId_forDate_calendarEventId: {
                  leadId: lead.id,
                  forDate,
                  calendarEventId: ev.id,
                },
              },
              create: {
                leadId: lead.id,
                forDate,
                calendarEventId: ev.id,
                formSnapshot: (form || null) as Prisma.InputJsonValue,
                researchSnapshot: researchSnapshot || undefined,
                status: 'READY',
              },
              update: {
                formSnapshot: (form || null) as Prisma.InputJsonValue,
                researchSnapshot: researchSnapshot || undefined,
                status: 'READY',
              },
            })
            summary.briefs++
          }
        } catch (err) {
          if (isGoogleInvalidGrantError(err)) {
            await markGoogleCalendarConnectionRevoked(userId)
          }
          summary.errors.push(
            `gcal ${userId}: ${err instanceof Error ? err.message : 'fail'}`,
          )
        }
      }
    }

    // Fathom backfill (last 3 days) — cron auto-scores after ingest
    if (fathom?.credentials) {
      const apiKey = decryptToken(
        (fathom.credentials as { apiKey?: string }).apiKey,
      )
      if (apiKey) {
        try {
          const after = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
          const meetings = await listFathomMeetings(apiKey, {
            limit: 25,
            created_after: after.toISOString(),
          })
          const ownerEmails = new Set<string>()
          if (user.email) ownerEmails.add(user.email.toLowerCase())
          const ownerNames: string[] = []
          for (const m of meetings) {
            if (m.recorded_by?.email) {
              ownerEmails.add(m.recorded_by.email.toLowerCase())
            }
            if (m.recorded_by?.name?.trim()) {
              ownerNames.push(m.recorded_by.name.trim())
            }
            await ingestFathomMeetingForUser({
              userId,
              ownerEmail: user.email,
              meeting: m,
              autoScore: true,
              geminiApiKey,
            })
            summary.meetingsSynced++
          }
          await purgeOwnerSelfLeads({
            userId,
            ownerEmails: [...ownerEmails],
            ownerNames,
          })
        } catch (err) {
          summary.errors.push(
            `fathom ${userId}: ${err instanceof Error ? err.message : 'fail'}`,
          )
        }
      }
    }

    // Attach default agent to leads that still lack one (needed for scoring)
    if (settings.defaultAgentId) {
      await prismaClient.callIntelLead.updateMany({
        where: {
          userId,
          selectedAgentId: null,
          meetings: { some: {} },
        },
        data: { selectedAgentId: settings.defaultAgentId },
      })
    }

    // Score meetings that have lead agent + summary but no score
    const unscored = await prismaClient.callIntelMeeting.findMany({
      where: {
        userId,
        summary: { not: null },
        lead: { selectedAgentId: { not: null } },
        scores: { none: {} },
      },
      take: MAX_SCORES_PER_USER,
      include: { lead: { select: { selectedAgentId: true } } },
    })
    for (const meeting of unscored) {
      const agentId = meeting.lead?.selectedAgentId
      if (!agentId || !geminiApiKey) continue
      try {
        await scoreMeetingAndSave({
          meetingId: meeting.id,
          agentId,
          apiKey: geminiApiKey,
        })
        summary.scores++
      } catch (err) {
        summary.errors.push(
          `score ${meeting.id}: ${err instanceof Error ? err.message : 'fail'}`,
        )
      }
    }

    // Research leads that have meetings but no dossier yet (Fathom-only / Instant)
    if (geminiApiKey && researchCount < MAX_RESEARCH_PER_USER) {
      const candidates = await prismaClient.callIntelLead.findMany({
        where: {
          userId,
          meetings: { some: {} },
        },
        orderBy: { lastAppointmentAt: 'desc' },
        take: 40,
        select: {
          id: true,
          name: true,
          email: true,
          company: true,
          webResearchJson: true,
        },
      })
      const needsResearch = candidates
        .filter((l) => l.webResearchJson == null)
        .slice(0, MAX_RESEARCH_PER_USER - researchCount)

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
            data: {
              webResearchJson: dossier as unknown as Prisma.InputJsonValue,
            },
          })
          researchCount++
          summary.research++
        } catch (err) {
          summary.errors.push(
            `research-meeting ${lead.email}: ${err instanceof Error ? err.message : 'fail'}`,
          )
        }
      }
    }

  }

  // Daily Maps batch: 10 new businesses + scrape those exact 10
  const setupUsers = await prismaClient.callIntelSettings.findMany({
    where: {
      businessLocation: { not: null },
      businessNiche: { not: null },
    },
    select: {
      userId: true,
      businessLocation: true,
      businessNiche: true,
      defaultAgentId: true,
    },
  })

  for (const settings of setupUsers) {
    const location = settings.businessLocation?.trim() || ''
    const niche = settings.businessNiche?.trim() || ''
    if (!location || !niche) continue

    try {
      if (await hasCronBatchToday(settings.userId)) continue
      const apiKey = await resolveSerperApiKey(settings.userId)
      if (!apiKey) {
        summary.errors.push(`business-batch ${settings.userId}: no Serper key`)
        continue
      }
      if (!canUseScrapeAgent()) {
        summary.errors.push(
          `business-batch ${settings.userId}: scrape agent not configured`,
        )
      }

      const batch = await createBusinessLeadBatch({
        userId: settings.userId,
        location,
        niche,
        apiKey,
        source: 'CRON',
        defaultAgentId: settings.defaultAgentId,
        scrape: true,
      })
      summary.businessBatches++
      summary.businessLeads += batch.count
      summary.websiteScrapes += batch.scraped
    } catch (err) {
      summary.errors.push(
        `business-batch ${settings.userId}: ${err instanceof Error ? err.message : 'fail'}`,
      )
    }
  }

  return NextResponse.json({ ok: true, summary })
}

export async function POST(req: NextRequest) {
  return GET(req)
}
