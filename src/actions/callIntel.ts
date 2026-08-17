'use server'

import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import { Prisma } from '@prisma/client'
import { onAuthenticateUser } from '@/actions/auth'
import { prismaClient } from '@/lib/prismaClient'
import { decryptToken, encryptToken } from '@/lib/messages/encrypt'
import {
  createFathomWebhook,
  deleteFathomWebhook,
  listFathomMeetings,
  isSyntheticFathomEmail,
  syntheticLeadEmail,
} from '@/lib/fathom/client'
import { ingestFathomMeetingForUser, purgeOwnerSelfLeads } from '@/lib/leads/ingestFathomMeeting'
import {
  scoreMeetingAndSave,
  scoreScrapeVsAgent,
  isFailedApiScore,
} from '@/lib/leads/scoreSummaryVsAgent'
import {
  buildMeetingScoreDetail,
  type MeetingScoreDetail,
} from '@/lib/leads/scoreTypes'
import { webResearchLead, resolveSerperApiKey } from '@/lib/leads/webResearch'
import {
  MAPS_LOCATION_SUGGESTIONS,
  MAPS_NICHE_SUGGESTIONS,
  cleanLocationSuggestion,
  cleanNicheSuggestion,
  filterCurated,
  mergeUniqueSuggestions,
} from '@/lib/leads/leadFindSuggestions'
import {
  enrichLeadWebsiteSync,
} from '@/lib/leads/enrichLeadWebsite'
import { isScrapeAgentConfigured } from '@/lib/leads/scrapeAgentClient'
import {
  createBusinessLeadBatch,
  listRecentLeadSearchBatches,
} from '@/lib/leads/createBusinessLeadBatch'
import {
  canUseScrapeAgent,
  ensureLeadWebsiteScraped,
} from '@/lib/leads/scrapeAgentSupervisor'
import type { LeadOutboundStatus, LeadActivityType } from '@prisma/client'
import { askMeetingChatQuestion } from '@/lib/leads/meetingChat'
import { projectFormByEmail } from '@/lib/leads/projectFormByEmail'
import {
  resolveUserGeminiApiKey,
  userHasLlmKeys,
} from '@/lib/leads/resolveUserLlmKey'
import {
  listSalesEvents,
  pickAttendeeEmail,
  eventStartDate,
  refreshGoogleAccessToken,
  resolveGoogleOAuthCredentials,
  isGoogleInvalidGrantError,
  markGoogleCalendarConnectionRevoked,
  googleCalendarNeedsReconnect,
  googleOAuthClientMismatch,
  createGoogleMeetEvent,
  type CalendarFilterMode,
} from '@/lib/leads/googleCalendar'
import {
  isDatabaseConnectivityError,
  logDatabaseConnectivityFailure,
} from '@/lib/prismaErrors'

type ActionOk<T = undefined> = { ok: true; data?: T }
type ActionErr = { ok: false; error: string }
type ActionResult<T = undefined> = ActionOk<T> | ActionErr

async function requireUser() {
  const auth = await onAuthenticateUser()
  if (!auth.user) return null
  return auth.user
}

function revalidateLeadPages() {
  revalidatePath('/lead')
  revalidateTag('lead-dashboard')
}

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_STS_AI_URL?.replace(/\/$/, '') ||
    'http://localhost:3000'
  )
}

export async function connectFathom(apiKey: string): Promise<ActionResult> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' }
  const key = apiKey.trim()
  if (!key) return { ok: false, error: 'API key is required' }

  try {
    // Validate key by listing meetings
    await listFathomMeetings(key, { limit: 1 })

    const destinationUrl = `${appBaseUrl()}/api/webhooks/fathom?userId=${user.id}`
    let webhookMeta: Record<string, unknown> = {}
    try {
      const wh = await createFathomWebhook(key, destinationUrl, true)
      webhookMeta = {
        webhookId: wh.id || null,
        webhookSecret: wh.secret ? encryptToken(String(wh.secret)) : null,
        destinationUrl,
      }
    } catch (err) {
      console.warn('Fathom webhook create skipped', err)
      webhookMeta = { destinationUrl, webhookError: 'Could not create webhook' }
    }

    await prismaClient.callIntelConnection.upsert({
      where: {
        userId_provider: { userId: user.id, provider: 'FATHOM' },
      },
      create: {
        userId: user.id,
        provider: 'FATHOM',
        status: 'ACTIVE',
        credentials: { apiKey: encryptToken(key) },
        metadata: webhookMeta as Prisma.InputJsonValue,
      },
      update: {
        status: 'ACTIVE',
        credentials: { apiKey: encryptToken(key) },
        metadata: webhookMeta as Prisma.InputJsonValue,
      },
    })

    revalidateLeadPages()
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to connect Fathom'
    return { ok: false, error: message }
  }
}

export async function disconnectCallIntelProvider(
  provider: 'FATHOM' | 'GOOGLE_CALENDAR',
): Promise<ActionResult> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' }

  const existing = await prismaClient.callIntelConnection.findUnique({
    where: { userId_provider: { userId: user.id, provider } },
  })

  if (provider === 'FATHOM' && existing?.credentials) {
    const creds = existing.credentials as { apiKey?: string }
    const meta = (existing.metadata || {}) as { webhookId?: string }
    const apiKey = decryptToken(creds.apiKey)
    if (apiKey && meta.webhookId) {
      try {
        await deleteFathomWebhook(apiKey, meta.webhookId)
      } catch {
        /* ignore */
      }
    }
  }

  await prismaClient.callIntelConnection.deleteMany({
    where: { userId: user.id, provider },
  })
  revalidateLeadPages()
  return { ok: true }
}

export async function syncRecentFathomMeetings(): Promise<ActionResult<{ count: number }>> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' }

  const conn = await prismaClient.callIntelConnection.findUnique({
    where: { userId_provider: { userId: user.id, provider: 'FATHOM' } },
  })
  if (!conn?.credentials) return { ok: false, error: 'Fathom not connected' }

  const apiKey = decryptToken((conn.credentials as { apiKey?: string }).apiKey)
  if (!apiKey) return { ok: false, error: 'Missing Fathom API key' }

  try {
    const geminiApiKey = await resolveUserGeminiApiKey(user.id)
    // List already requests include_summary=true (default_summary.markdown_formatted)
    const meetings = await listFathomMeetings(apiKey, { limit: 20 })
    let count = 0
    const ownerEmails = new Set<string>()
    if (user.email) ownerEmails.add(user.email.toLowerCase())
    const ownerNames: string[] = []

    for (const m of meetings) {
      if (m.recorded_by?.email) ownerEmails.add(m.recorded_by.email.toLowerCase())
      if (m.recorded_by?.name?.trim()) ownerNames.push(m.recorded_by.name.trim())
      // Manual sync: ingest only. Score + research stay manual for instant Meets.
      await ingestFathomMeetingForUser({
        userId: user.id,
        ownerEmail: user.email,
        meeting: m,
        autoScore: false,
        geminiApiKey,
      })
      count++
    }

    // Drop leftover self-leads (e.g. itsmrapon) from the old identity bug
    await purgeOwnerSelfLeads({
      userId: user.id,
      ownerEmails: [...ownerEmails],
      ownerNames,
    })

    revalidateLeadPages()
    return { ok: true, data: { count } }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Sync failed',
    }
  }
}

export async function setLeadAgent(
  leadId: string,
  agentId: string | null,
): Promise<ActionResult> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' }

  const lead = await prismaClient.callIntelLead.findFirst({
    where: { id: leadId, userId: user.id },
  })
  if (!lead) return { ok: false, error: 'Lead not found' }

  if (agentId) {
    const agent = await prismaClient.liveKitAgent.findUnique({
      where: { id: agentId },
      select: { id: true },
    })
    if (!agent) return { ok: false, error: 'Agent not found' }
  }

  await prismaClient.callIntelLead.update({
    where: { id: leadId },
    data: { selectedAgentId: agentId },
  })
  revalidateLeadPages()
  return { ok: true }
}

export async function saveLeadNotes(
  leadId: string,
  notes: string,
): Promise<ActionResult> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' }

  const updated = await prismaClient.callIntelLead.updateMany({
    where: { id: leadId, userId: user.id },
    data: { notes },
  })
  if (updated.count === 0) return { ok: false, error: 'Lead not found' }
  revalidateLeadPages()
  revalidatePath(`/lead/${leadId}`)
  return { ok: true }
}

export async function askLeadMeetingChat(input: {
  meetingId: string
  message: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
}): Promise<ActionResult<{ reply: string }>> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' }

  const result = await askMeetingChatQuestion({
    userId: user.id,
    meetingId: input.meetingId,
    message: input.message,
    history: input.history,
  })

  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, data: { reply: result.reply } }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Creator can fill email/company when Fathom had no guest email / company.
 * Empty email keeps (or restores) a synthetic @fathom.local placeholder.
 * Returns the canonical leadId (may change if email merges into an existing lead).
 */
export async function saveLeadDetails(
  leadId: string,
  input: { email?: string; company?: string },
): Promise<ActionResult<{ leadId: string }>> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' }

  const lead = await prismaClient.callIntelLead.findFirst({
    where: { id: leadId, userId: user.id },
  })
  if (!lead) return { ok: false, error: 'Lead not found' }

  const companyRaw =
    input.company !== undefined ? input.company.trim() : undefined
  const company =
    companyRaw === undefined ? undefined : companyRaw.length ? companyRaw : null

  let nextEmail: string | undefined
  if (input.email !== undefined) {
    const trimmed = input.email.trim().toLowerCase()
    if (!trimmed) {
      nextEmail = isSyntheticFathomEmail(lead.email)
        ? lead.email
        : syntheticLeadEmail(lead.name)
    } else {
      if (!EMAIL_RE.test(trimmed)) {
        return { ok: false, error: 'Enter a valid email address' }
      }
      if (user.email && trimmed === user.email.toLowerCase()) {
        return { ok: false, error: 'Lead email cannot be your own account email' }
      }
      nextEmail = trimmed
    }
  }

  try {
    if (nextEmail && nextEmail !== lead.email.toLowerCase()) {
      const existing = await prismaClient.callIntelLead.findUnique({
        where: {
          userId_email: { userId: user.id, email: nextEmail },
        },
        select: { id: true },
      })

      if (existing && existing.id !== lead.id) {
        // Merge this lead into the one that already has that email
        await prismaClient.callIntelMeeting.updateMany({
          where: { leadId: lead.id },
          data: { leadId: existing.id },
        })
        await prismaClient.callIntelBrief.updateMany({
          where: { leadId: lead.id },
          data: { leadId: existing.id },
        })
        if (company !== undefined) {
          await prismaClient.callIntelLead.update({
            where: { id: existing.id },
            data: { company },
          })
        }
        await prismaClient.callIntelLead.delete({ where: { id: lead.id } })
        revalidateLeadPages()
        revalidatePath(`/lead/${existing.id}`)
        return { ok: true, data: { leadId: existing.id } }
      }

      await prismaClient.callIntelLead.update({
        where: { id: lead.id },
        data: {
          email: nextEmail,
          ...(company !== undefined ? { company } : {}),
        },
      })
    } else if (company !== undefined) {
      await prismaClient.callIntelLead.update({
        where: { id: lead.id },
        data: { company },
      })
    }

    revalidateLeadPages()
    revalidatePath(`/lead/${leadId}`)
    return { ok: true, data: { leadId } }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not save details',
    }
  }
}

export async function runLeadScore(
  meetingId: string,
  options?: { deepScore?: boolean },
): Promise<ActionResult> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' }

  const meeting = await prismaClient.callIntelMeeting.findFirst({
    where: { id: meetingId, userId: user.id },
    include: { lead: true },
  })
  if (!meeting) return { ok: false, error: 'Meeting not found' }
  if (!meeting.lead?.selectedAgentId) {
    return { ok: false, error: 'Select an /ai-agents rulebook on this lead first' }
  }
  if (!meeting.summary) {
    return { ok: false, error: 'Meeting has no Fathom summary yet' }
  }

  try {
    const apiKey = await resolveUserGeminiApiKey(user.id)
    if (!apiKey) {
      return {
        ok: false,
        error:
          'Gemini API key missing. Add it in Config Agent (/ai-agents/config).',
      }
    }
    await scoreMeetingAndSave({
      meetingId: meeting.id,
      agentId: meeting.lead.selectedAgentId,
      apiKey,
      deepScore: options?.deepScore,
    })
    revalidateLeadPages()
    revalidatePath(`/lead/${meeting.lead.id}`)
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Score failed',
    }
  }
}

/** Score Business lead scrape against the selected agent prompt (not Fathom summary). */
export async function runLeadPlaybookScore(
  leadId: string,
): Promise<ActionResult> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' }

  const lead = await prismaClient.callIntelLead.findFirst({
    where: { id: leadId, userId: user.id },
    select: {
      id: true,
      selectedAgentId: true,
      webResearchJson: true,
      website: true,
    },
  })
  if (!lead) return { ok: false, error: 'Lead not found' }
  if (!lead.selectedAgentId) {
    return { ok: false, error: 'Select an AI agent rulebook on this lead first' }
  }

  const agent = await prismaClient.liveKitAgent.findUnique({
    where: { id: lead.selectedAgentId },
    select: { systemPrompt: true, name: true },
  })
  if (!agent?.systemPrompt?.trim()) {
    return { ok: false, error: 'Agent has an empty system prompt' }
  }

  const research = (lead.webResearchJson || {}) as Record<string, unknown>
  const enrichment = research.websiteEnrichment as
    | Record<string, unknown>
    | undefined
  const scrapeParts = [
    enrichment?.companySummary,
    Array.isArray(enrichment?.services)
      ? `Services: ${(enrichment.services as string[]).join(', ')}`
      : null,
    Array.isArray(enrichment?.highlights)
      ? `Highlights: ${(enrichment.highlights as string[]).join('; ')}`
      : null,
    Array.isArray(enrichment?.flags)
      ? `Flags: ${(enrichment.flags as string[]).join('; ')}`
      : null,
    lead.website ? `Website: ${lead.website}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  if (!scrapeParts.trim()) {
    return {
      ok: false,
      error: 'No scrape data yet. Open ScrapeGraphAI and wait for scrape to finish.',
    }
  }

  try {
    const apiKey = await resolveUserGeminiApiKey(user.id)
    if (!apiKey) {
      return {
        ok: false,
        error:
          'Gemini API key missing. Add it in Config Agent (/ai-agents/config).',
      }
    }

    const raw = await scoreScrapeVsAgent({
      scrapeText: scrapeParts,
      systemPrompt: agent.systemPrompt,
      apiKey,
      accountUserId: user.id,
    })

    const detail = buildMeetingScoreDetail({
      id: `playbook-${lead.id}`,
      agentId: lead.selectedAgentId,
      agentName: agent.name,
      scoredAt: new Date(),
      covered: raw.covered,
      missed: raw.missed,
      issues: raw.issues,
      nextSteps: raw.nextSteps,
      rawJson: {
        ...raw.raw,
        source: 'scrape_vs_prompt',
      },
    })

    await prismaClient.callIntelLead.update({
      where: { id: lead.id },
      data: {
        webResearchJson: {
          ...research,
          playbookScore: detail,
        } as Prisma.InputJsonValue,
      },
    })

    revalidateLeadPages()
    revalidatePath(`/lead/${lead.id}`)
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Playbook score failed',
    }
  }
}

export async function refreshLeadResearch(leadId: string): Promise<ActionResult> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' }

  const lead = await prismaClient.callIntelLead.findFirst({
    where: { id: leadId, userId: user.id },
  })
  if (!lead) return { ok: false, error: 'Lead not found' }

  try {
    const geminiApiKey = await resolveUserGeminiApiKey(user.id)
    if (!geminiApiKey) {
      return {
        ok: false,
        error:
          'Gemini API key missing. Add it in Config Agent (/ai-agents/config).',
      }
    }
    let dossier = await webResearchLead({
      name: lead.name,
      email: isSyntheticFathomEmail(lead.email) ? '' : lead.email,
      company: lead.company,
      userId: user.id,
      geminiApiKey,
    })

    // Google/business leads with a website: deep-scrape via Python ScrapeGraphAI worker
    const website = lead.website?.trim()
    if (website && isScrapeAgentConfigured()) {
      const scraped = await enrichLeadWebsiteSync({
        leadId: lead.id,
        userId: user.id,
        website,
        name: lead.name,
        company: lead.company,
        geminiApiKey,
        existingResearch: dossier,
      })
      if (scraped.ok) {
        dossier = scraped.dossier
      } else if (!scraped.skipped) {
        dossier = {
          ...dossier,
          flags: [
            `Website scrape unavailable: ${scraped.error}`,
            ...dossier.flags,
          ].slice(0, 12),
        }
      }
    }

    await prismaClient.callIntelLead.update({
      where: { id: lead.id },
      data: { webResearchJson: dossier as unknown as Prisma.InputJsonValue },
    })
    revalidateLeadPages()
    revalidatePath(`/lead/${lead.id}`)
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Research failed',
    }
  }
}

/** Deep-scrape lead.website via Python ScrapeGraphAI worker (SCRAPE_AGENT_URL). */
export async function refreshLeadWebsiteScrape(
  leadId: string,
): Promise<ActionResult> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' }

  const lead = await prismaClient.callIntelLead.findFirst({
    where: { id: leadId, userId: user.id },
    select: {
      id: true,
      name: true,
      company: true,
      website: true,
      webResearchJson: true,
    },
  })
  if (!lead) return { ok: false, error: 'Lead not found' }

  const website = lead.website?.trim()
  if (!website) {
    return {
      ok: false,
      error: 'No website on this lead. Add a website URL first.',
    }
  }

  if (!canUseScrapeAgent()) {
    return {
      ok: false,
      error:
        'Scrape agent not configured. Set SCRAPE_AGENT_MANAGED=1 on Coolify or SCRAPE_AGENT_URL.',
    }
  }

  try {
    const { withScrapeAgent } = await import(
      '@/lib/leads/scrapeAgentSupervisor'
    )
    const geminiApiKey = await resolveUserGeminiApiKey(user.id)
    const scraped = await withScrapeAgent(async () =>
      enrichLeadWebsiteSync({
        leadId: lead.id,
        userId: user.id,
        website,
        name: lead.name,
        company: lead.company,
        geminiApiKey,
        existingResearch: lead.webResearchJson,
      }),
    )

    if (!scraped.ok) {
      return { ok: false, error: scraped.error }
    }

    await prismaClient.callIntelLead.update({
      where: { id: lead.id },
      data: {
        webResearchJson: scraped.dossier as unknown as Prisma.InputJsonValue,
      },
    })
    revalidateLeadPages()
    revalidatePath(`/lead/${lead.id}`)
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Website scrape failed',
    }
  }
}

export async function saveSerperApiKey(apiKey: string): Promise<ActionResult> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' }

  const key = apiKey.trim()
  if (!key) return { ok: false, error: 'Serper API key is required' }

  await prismaClient.callIntelSettings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      serperApiKeyEnc: encryptToken(key),
    },
    update: {
      serperApiKeyEnc: encryptToken(key),
    },
  })

  revalidateLeadPages()
  return { ok: true }
}

export async function clearSerperApiKey(): Promise<ActionResult> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' }

  await prismaClient.callIntelSettings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      serperApiKeyEnc: null,
    },
    update: {
      serperApiKeyEnc: null,
    },
  })

  revalidateLeadPages()
  return { ok: true }
}

export async function saveBusinessLeadPrefs(input: {
  location: string
  niche: string
}): Promise<ActionResult> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' }

  const location = input.location.trim()
  const niche = input.niche.trim()
  if (!location) return { ok: false, error: 'Location is required' }
  if (!niche) return { ok: false, error: 'Niche / business type is required' }
  if (location.length > 255) {
    return { ok: false, error: 'Location is too long' }
  }
  if (niche.length > 255) {
    return { ok: false, error: 'Niche is too long' }
  }

  try {
    await prismaClient.callIntelSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        businessLocation: location,
        businessNiche: niche,
      },
      update: {
        businessLocation: location,
        businessNiche: niche,
      },
    })
  } catch (err) {
    console.error('saveBusinessLeadPrefs failed', err)
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message.slice(0, 200)
          : 'Failed to save Business settings',
    }
  }

  revalidateLeadPages()
  return { ok: true }
}

/**
 * Suggestive Find UX: curated Maps categories + live Serper Google autocomplete.
 * mode=location → place-like suggestions; mode=niche → business type suggestions.
 */
export async function suggestLeadFind(input: {
  mode: 'location' | 'niche'
  query: string
}): Promise<
  ActionResult<{
    suggestions: string[]
    source: 'curated' | 'serper' | 'mixed'
  }>
> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' }

  const query = input.query.trim().slice(0, 120)
  const mode = input.mode === 'niche' ? 'niche' : 'location'

  const curated =
    mode === 'niche'
      ? filterCurated(MAPS_NICHE_SUGGESTIONS, query, 8)
      : filterCurated(MAPS_LOCATION_SUGGESTIONS, query, 8)

  if (query.length < 2) {
    return {
      ok: true,
      data: { suggestions: curated, source: 'curated' },
    }
  }

  const apiKey = await resolveSerperApiKey(user.id)
  if (!apiKey) {
    return {
      ok: true,
      data: { suggestions: curated, source: 'curated' },
    }
  }

  try {
    const { fetchSerperAutocomplete } = await import(
      '@/lib/leads/serperAutocomplete'
    )

    // Bias Google autocomplete toward places vs business types.
    const autocompleteQuery =
      mode === 'location'
        ? query
        : query.toLowerCase().includes('near')
          ? query
          : `${query} near me`

    const raw = await fetchSerperAutocomplete({
      apiKey,
      query: autocompleteQuery,
    })

    const cleaned = raw
      .map((s) =>
        mode === 'niche'
          ? cleanNicheSuggestion(s)
          : cleanLocationSuggestion(s, query),
      )
      .filter((s) => s.length >= 2)

    const suggestions = mergeUniqueSuggestions(cleaned, curated).slice(0, 10)
    return {
      ok: true,
      data: {
        suggestions,
        source: cleaned.length > 0 ? 'mixed' : 'curated',
      },
    }
  } catch (err) {
    console.error('suggestLeadFind failed', err)
    return {
      ok: true,
      data: { suggestions: curated, source: 'curated' },
    }
  }
}

export async function syncBusinessLeads(): Promise<
  ActionResult<{
    count: number
    created: number
    scraped: number
    batchId: string
  }>
> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' }

  const settings = await prismaClient.callIntelSettings.findUnique({
    where: { userId: user.id },
    select: {
      businessLocation: true,
      businessNiche: true,
      defaultAgentId: true,
    },
  })

  const location = settings?.businessLocation?.trim() || ''
  const niche = settings?.businessNiche?.trim() || ''
  if (!location || !niche) {
    return {
      ok: false,
      error: 'Set location and niche in Search first',
    }
  }

  const apiKey = await resolveSerperApiKey(user.id)
  if (!apiKey) {
    return {
      ok: false,
      error: 'Add a Serper API key in Settings to sync Business leads',
    }
  }

  try {
    // Manual refresh: Maps pull only. Website scrape runs on lead open / cron.
    const batch = await createBusinessLeadBatch({
      userId: user.id,
      location,
      niche,
      apiKey,
      source: 'MANUAL',
      defaultAgentId: settings?.defaultAgentId || null,
      scrape: false,
    })

    revalidateLeadPages()
    return {
      ok: true,
      data: {
        count: batch.count,
        created: batch.created,
        scraped: 0,
        batchId: batch.batchId,
      },
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Business sync failed',
    }
  }
}

export async function setLeadOutboundStatus(
  leadId: string,
  status: LeadOutboundStatus,
): Promise<ActionResult> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' }
  if (!['NEW', 'ON_PROCESS', 'DONE'].includes(status)) {
    return { ok: false, error: 'Invalid status' }
  }

  const updated = await prismaClient.callIntelLead.updateMany({
    where: { id: leadId, userId: user.id },
    data: { outboundStatus: status },
  })
  if (updated.count === 0) return { ok: false, error: 'Lead not found' }

  revalidateLeadPages()
  revalidatePath(`/lead/${leadId}`)
  return { ok: true }
}

export async function addLeadActivity(input: {
  leadId: string
  type: LeadActivityType
  note?: string
  scheduledAt?: string | null
}): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' }

  const lead = await prismaClient.callIntelLead.findFirst({
    where: { id: input.leadId, userId: user.id },
    select: { id: true },
  })
  if (!lead) return { ok: false, error: 'Lead not found' }

  const scheduledAt = input.scheduledAt
    ? new Date(input.scheduledAt)
    : null
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
    return { ok: false, error: 'Invalid schedule date' }
  }

  const activity = await prismaClient.leadActivity.create({
    data: {
      userId: user.id,
      leadId: lead.id,
      type: input.type,
      note: input.note?.trim() || null,
      scheduledAt,
    },
    select: { id: true },
  })

  if (scheduledAt && (input.type === 'FOLLOW_UP' || input.type === 'MEET_SCHEDULED')) {
    await prismaClient.callIntelLead.update({
      where: { id: lead.id },
      data: { nextFollowUpAt: scheduledAt },
    })
  }

  revalidateLeadPages()
  revalidatePath(`/lead/${lead.id}`)
  return { ok: true, data: { id: activity.id } }
}

export async function scheduleLeadGoogleMeet(input: {
  leadId: string
  startIso: string
  durationMinutes?: number
  note?: string
}): Promise<ActionResult<{ meetLink: string | null; eventId: string }>> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' }

  const lead = await prismaClient.callIntelLead.findFirst({
    where: { id: input.leadId, userId: user.id },
    select: { id: true, name: true, email: true },
  })
  if (!lead) return { ok: false, error: 'Lead not found' }

  const start = new Date(input.startIso)
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: 'Invalid start time' }
  }
  const duration = Math.min(Math.max(input.durationMinutes || 30, 15), 180)
  const end = new Date(start.getTime() + duration * 60_000)

  const conn = await prismaClient.callIntelConnection.findUnique({
    where: {
      userId_provider: { userId: user.id, provider: 'GOOGLE_CALENDAR' },
    },
    select: { credentials: true, status: true, metadata: true },
  })
  if (!conn || conn.status !== 'ACTIVE' || !conn.credentials) {
    return { ok: false, error: 'Connect Google Calendar in Settings first' }
  }

  const refresh = decryptToken(
    (conn.credentials as { refreshToken?: string }).refreshToken,
  )
  if (!refresh) return { ok: false, error: 'Google Calendar needs reconnect' }

  try {
    const oauth = await resolveGoogleOAuthCredentials(user.id)
    if (!oauth) return { ok: false, error: 'Google OAuth credentials missing' }
    if (googleOAuthClientMismatch(conn, oauth.clientId)) {
      await markGoogleCalendarConnectionRevoked(user.id, 'oauth_client_changed')
      return {
        ok: false,
        error:
          'Google OAuth Client ID changed. Reconnect Calendar in Settings.',
      }
    }
    const tokens = await refreshGoogleAccessToken({
      refreshToken: refresh,
      clientId: oauth.clientId,
      clientSecret: oauth.clientSecret,
    })

    const attendeeEmail =
      lead.email && !lead.email.endsWith('@business.local')
        ? lead.email
        : null

    const created = await createGoogleMeetEvent({
      accessToken: tokens.access_token,
      summary: `Outreach: ${lead.name}`,
      description: input.note?.trim() || `Lead outreach with ${lead.name}`,
      start,
      end,
      attendeeEmail,
    })

    await prismaClient.leadActivity.create({
      data: {
        userId: user.id,
        leadId: lead.id,
        type: 'MEET_SCHEDULED',
        note: input.note?.trim() || null,
        scheduledAt: start,
        googleEventId: created.eventId || null,
        meetLink: created.meetLink,
      },
    })
    await prismaClient.callIntelLead.update({
      where: { id: lead.id },
      data: { nextFollowUpAt: start },
    })

    revalidateLeadPages()
    revalidatePath(`/lead/${lead.id}`)
    return {
      ok: true,
      data: { meetLink: created.meetLink, eventId: created.eventId },
    }
  } catch (err) {
    if (isGoogleInvalidGrantError(err)) {
      await markGoogleCalendarConnectionRevoked(user.id)
      return { ok: false, error: 'Google Calendar needs reconnect' }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to schedule Meet',
    }
  }
}

export async function ensureLeadScrapeOnOpen(
  leadId: string,
): Promise<ActionResult<{ scraped: boolean }>> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' }

  const lead = await prismaClient.callIntelLead.findFirst({
    where: { id: leadId, userId: user.id },
    select: { id: true, source: true },
  })
  if (!lead) return { ok: false, error: 'Lead not found' }
  if (lead.source !== 'BUSINESS') {
    return { ok: true, data: { scraped: false } }
  }
  if (!canUseScrapeAgent()) {
    return { ok: true, data: { scraped: false } }
  }

  const result = await ensureLeadWebsiteScraped({
    leadId: lead.id,
    userId: user.id,
  })
  if (!result.ok) return { ok: false, error: result.error }
  if (result.scraped) {
    revalidatePath(`/lead/${lead.id}`)
  }
  return { ok: true, data: { scraped: result.scraped } }
}

export async function saveGoogleOAuthApp(input: {
  clientId: string
  clientSecret: string
}): Promise<ActionResult<{ requiresCalendarReconnect?: boolean }>> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' }

  const clientId = input.clientId.trim()
  const clientSecret = input.clientSecret.trim()
  if (!clientId || !clientSecret) {
    return { ok: false, error: 'Client ID and Client Secret are required' }
  }

  const existingSettings = await prismaClient.callIntelSettings.findUnique({
    where: { userId: user.id },
    select: { googleClientIdEnc: true },
  })
  const previousClientId = decryptToken(existingSettings?.googleClientIdEnc)
  const envClientId = process.env.GOOGLE_CLIENT_ID?.trim() || null

  // Refresh tokens are bound to the OAuth client. Changing Client ID after
  // Connect Calendar breaks refresh until the user reconnects.
  const gcal = await prismaClient.callIntelConnection.findUnique({
    where: {
      userId_provider: { userId: user.id, provider: 'GOOGLE_CALENDAR' },
    },
    select: { status: true, metadata: true },
  })
  const connectedClientId =
    (gcal?.metadata as { oauthClientId?: string } | null)?.oauthClientId ||
    previousClientId ||
    envClientId

  let requiresCalendarReconnect = false
  if (
    gcal &&
    (gcal.status === 'ACTIVE' || gcal.status === 'ERROR') &&
    connectedClientId &&
    connectedClientId !== clientId
  ) {
    await markGoogleCalendarConnectionRevoked(user.id, 'oauth_client_changed')
    requiresCalendarReconnect = true
  }

  await prismaClient.callIntelSettings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      googleClientIdEnc: encryptToken(clientId),
      googleClientSecretEnc: encryptToken(clientSecret),
    },
    update: {
      googleClientIdEnc: encryptToken(clientId),
      googleClientSecretEnc: encryptToken(clientSecret),
    },
  })

  revalidateLeadPages()
  revalidatePath('/settings')
  return { ok: true, data: { requiresCalendarReconnect } }
}

export async function saveCallIntelSetup(input: {
  defaultAgentId: string
  selectedWebinarIds: string[]
  calendarFilterMode?: CalendarFilterMode
  calendarKeyword?: string | null
  complete?: boolean
}): Promise<ActionResult> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' }

  if (!input.defaultAgentId) {
    return { ok: false, error: 'Select an AI agent rulebook' }
  }
  if (!input.selectedWebinarIds.length) {
    return { ok: false, error: 'Select at least one project' }
  }

  const agent = await prismaClient.liveKitAgent.findUnique({
    where: { id: input.defaultAgentId },
    select: { id: true },
  })
  if (!agent) return { ok: false, error: 'Agent not found' }

  const owned = await prismaClient.webinar.findMany({
    where: {
      presenterId: user.id,
      id: { in: input.selectedWebinarIds },
    },
    select: { id: true },
  })
  if (owned.length !== input.selectedWebinarIds.length) {
    return { ok: false, error: 'One or more projects are invalid' }
  }

  const fathom = await prismaClient.callIntelConnection.findUnique({
    where: { userId_provider: { userId: user.id, provider: 'FATHOM' } },
  })
  const gcal = await prismaClient.callIntelConnection.findUnique({
    where: {
      userId_provider: { userId: user.id, provider: 'GOOGLE_CALENDAR' },
    },
  })
  const oauth = await resolveGoogleOAuthCredentials(user.id)

  if (input.complete) {
    if (!fathom || fathom.status !== 'ACTIVE') {
      return { ok: false, error: 'Connect Fathom before finishing setup' }
    }
    if (!oauth) {
      return {
        ok: false,
        error: 'Add Google OAuth Client ID & Secret (or set them in env)',
      }
    }
    if (!gcal || gcal.status !== 'ACTIVE') {
      return { ok: false, error: 'Connect Google Calendar before finishing setup' }
    }
  }

  const filterMode: CalendarFilterMode =
    input.calendarFilterMode === 'KEYWORD' ? 'KEYWORD' : 'ALL'

  await prismaClient.callIntelSettings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      defaultAgentId: input.defaultAgentId,
      selectedWebinarIds: input.selectedWebinarIds,
      calendarFilterMode: filterMode,
      calendarKeyword:
        filterMode === 'KEYWORD'
          ? (input.calendarKeyword || '[Sales]').trim()
          : null,
      setupCompletedAt: input.complete ? new Date() : null,
    },
    update: {
      defaultAgentId: input.defaultAgentId,
      selectedWebinarIds: input.selectedWebinarIds,
      calendarFilterMode: filterMode,
      calendarKeyword:
        filterMode === 'KEYWORD'
          ? (input.calendarKeyword || '[Sales]').trim()
          : null,
      setupCompletedAt: input.complete ? new Date() : undefined,
    },
  })

  revalidateLeadPages()
  return { ok: true }
}

export async function saveCalendarEventFilter(input: {
  calendarFilterMode: CalendarFilterMode
  calendarKeyword?: string | null
}): Promise<ActionResult> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' }

  const filterMode: CalendarFilterMode =
    input.calendarFilterMode === 'KEYWORD' ? 'KEYWORD' : 'ALL'

  await prismaClient.callIntelSettings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      calendarFilterMode: filterMode,
      calendarKeyword:
        filterMode === 'KEYWORD'
          ? (input.calendarKeyword || '[Sales]').trim()
          : null,
    },
    update: {
      calendarFilterMode: filterMode,
      calendarKeyword:
        filterMode === 'KEYWORD'
          ? (input.calendarKeyword || '[Sales]').trim()
          : null,
    },
  })
  revalidateLeadPages()
  revalidatePath('/settings')
  return { ok: true }
}

export type CallIntelDashboardUnavailable = { unavailable: true }

export async function getCallIntelDashboard(resolvedUser?: {
  id: string
  email: string
  name: string
}) {
  const user = resolvedUser ?? (await requireUser())
  if (!user) return null

  try {
    return await loadCallIntelDashboard(user)
  } catch (err) {
    if (isDatabaseConnectivityError(err)) {
      logDatabaseConnectivityFailure('getCallIntelDashboard', err)
      return { unavailable: true } satisfies CallIntelDashboardUnavailable
    }
    throw err
  }
}

async function loadCallIntelDashboard(
  user: { id: string; email: string; name: string },
) {
  const [connections, settings, agents, llmKeys] = await Promise.all([
    prismaClient.callIntelConnection.findMany({
      where: { userId: user.id },
      select: {
        provider: true,
        status: true,
        credentials: true,
        metadata: true,
        updatedAt: true,
      },
    }),
    prismaClient.callIntelSettings.findUnique({
      where: { userId: user.id },
    }),
    prismaClient.liveKitAgent.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
      take: 100,
    }),
    userHasLlmKeys(user.id),
  ])

  const fathomOk = connections.some(
    (c) => c.provider === 'FATHOM' && c.status === 'ACTIVE',
  )
  const gcalOk = connections.some(
    (c) => c.provider === 'GOOGLE_CALENDAR' && c.status === 'ACTIVE',
  )
  const agentOk = Boolean(settings?.defaultAgentId)
  const projectsOk = Boolean(settings?.selectedWebinarIds?.length)
  const gcalConn = connections.find((c) => c.provider === 'GOOGLE_CALENDAR')
  const gcalRefresh = gcalConn?.credentials
    ? decryptToken(
        (gcalConn.credentials as { refreshToken?: string }).refreshToken,
      )
    : null
  const oauthForStatus = await resolveGoogleOAuthCredentials(user.id)
  let gcalNeedsReconnect = googleCalendarNeedsReconnect(
    gcalConn,
    gcalRefresh,
    oauthForStatus?.clientId,
  )

  // Client ID in Settings no longer matches the client that issued the token.
  // Flag reconnect without calling Google (avoids wiping on every page load).
  if (
    gcalOk &&
    gcalRefresh &&
    googleOAuthClientMismatch(gcalConn, oauthForStatus?.clientId)
  ) {
    await markGoogleCalendarConnectionRevoked(user.id, 'oauth_client_changed')
    gcalNeedsReconnect = true
  }

  const [leads, searchBatches, calendarMonth, serperKey] = await Promise.all([
    getLeadListRowsCached(user.id, settings?.defaultAgentId || null),
    listRecentLeadSearchBatches(user.id),
    getLeadCalendarMonthCached(user.id, user.email || ''),
    resolveSerperApiKey(user.id),
  ])

  return {
    user: { id: user.id, email: user.email, name: user.name },
    connections: connections.map((c) => ({
      provider: c.provider,
      status: c.status,
    })),
    settings: settings
      ? {
          defaultAgentId: settings.defaultAgentId,
          selectedWebinarIds: settings.selectedWebinarIds,
          calendarFilterMode: (settings.calendarFilterMode === 'KEYWORD'
            ? 'KEYWORD'
            : 'ALL') as 'ALL' | 'KEYWORD',
          calendarKeyword: settings.calendarKeyword ?? null,
          hasUserGoogleOAuth: Boolean(
            settings.googleClientIdEnc && settings.googleClientSecretEnc,
          ),
          hasUserSerperKey: Boolean(settings.serperApiKeyEnc),
          businessLocation: settings.businessLocation ?? null,
          businessNiche: settings.businessNiche ?? null,
          setupCompletedAt: settings.setupCompletedAt?.toISOString() || null,
        }
      : null,
    setup: {
      complete: true,
      fathomOk,
      gcalOk: gcalOk && !gcalNeedsReconnect,
      gcalNeedsReconnect,
      agentOk,
      projectsOk,
    },
    agents,
    leads,
    searchBatches,
    calendarMonth,
    serperConfigured: Boolean(serperKey),
    geminiResearchReady: llmKeys.hasGemini,
    googleOAuthConfigured: Boolean(oauthForStatus),
    hasGeminiKey: llmKeys.hasGemini,
  }
}

function mapMeetingScore(
  score: {
    id: string
    agentId: string
    covered: string[]
    missed: string[]
    issues: string[]
    nextSteps: string[]
    scoredAt: Date
    rawJson?: unknown
  } | null | undefined,
  agentNameById: Map<string, string>,
): MeetingScoreDetail | null {
  if (!score) return null
  if (isFailedApiScore(score)) return null
  return buildMeetingScoreDetail({
    id: score.id,
    agentId: score.agentId,
    agentName: agentNameById.get(score.agentId) || null,
    scoredAt: score.scoredAt,
    covered: score.covered,
    missed: score.missed,
    issues: score.issues,
    nextSteps: score.nextSteps,
    rawJson: score.rawJson,
  })
}

function mapMeetingScores(
  scores: Array<{
    id: string
    agentId: string
    covered: string[]
    missed: string[]
    issues: string[]
    nextSteps: string[]
    scoredAt: Date
    rawJson?: unknown
  }>,
  agentNameById: Map<string, string>,
) {
  return scores
    .map((s) => mapMeetingScore(s, agentNameById))
    .filter(Boolean) as MeetingScoreDetail[]
}

async function buildLeadListRows(
  userId: string,
  defaultAgentId: string | null,
) {
  const [leads, agents] = await Promise.all([
    prismaClient.callIntelLead.findMany({
      where: { userId },
      orderBy: [{ lastAppointmentAt: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        notes: true,
        phone: true,
        website: true,
        address: true,
        selectedAgentId: true,
        lastAppointmentAt: true,
        updatedAt: true,
        nextFollowUpAt: true,
        source: true,
        outboundStatus: true,
        searchBatchId: true,
        webResearchJson: true,
        meetings: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            summary: true,
            recordedAt: true,
            fathomUrl: true,
            scores: { orderBy: { scoredAt: 'desc' }, take: 1 },
          },
        },
        searchBatch: {
          select: { id: true, createdAt: true, location: true, niche: true },
        },
      },
    }),
    prismaClient.liveKitAgent.findMany({
      select: { id: true, name: true },
      take: 200,
    }),
  ])

  const agentNameById = new Map(agents.map((a) => [a.id, a.name]))

  return leads.map((lead) => {
    const meeting = lead.meetings[0] || null
    const score = meeting?.scores[0]
    const isBusiness = lead.source === 'BUSINESS'
    const emailIsSynthetic =
      isBusiness || isSyntheticFathomEmail(lead.email)
    const kind = isBusiness
      ? ('Business' as const)
      : emailIsSynthetic && isSyntheticFathomEmail(lead.email)
        ? ('Instant' as const)
        : ('Calendar' as const)
    return {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      emailIsSynthetic,
      company: lead.company,
      notes: lead.notes,
      phone: lead.phone,
      website: lead.website,
      address: lead.address,
      selectedAgentId: lead.selectedAgentId || defaultAgentId,
      lastAppointmentAt: lead.lastAppointmentAt?.toISOString() || null,
      updatedAt: lead.updatedAt.toISOString(),
      nextFollowUpAt: lead.nextFollowUpAt?.toISOString() || null,
      kind,
      outboundStatus: lead.outboundStatus as LeadOutboundStatus,
      searchBatchId: lead.searchBatchId,
      searchBatch: lead.searchBatch
        ? {
            id: lead.searchBatch.id,
            createdAt: lead.searchBatch.createdAt.toISOString(),
            location: lead.searchBatch.location,
            niche: lead.searchBatch.niche,
          }
        : null,
      hasResearch: Boolean(lead.webResearchJson),
      meeting: meeting
        ? {
            id: meeting.id,
            summary: meeting.summary,
            recordedAt: meeting.recordedAt.toISOString(),
            fathomUrl: meeting.fathomUrl,
            score: mapMeetingScore(score, agentNameById),
          }
        : null,
    }
  })
}

async function buildLeadCalendarMonth(userId: string, ownerEmail?: string | null) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const [activities, followUps, todayBatch, meetings, settings, gcal] =
    await Promise.all([
      prismaClient.leadActivity.findMany({
        where: {
          userId,
          OR: [
            { scheduledAt: { gte: monthStart, lte: monthEnd } },
            {
              scheduledAt: null,
              createdAt: { gte: monthStart, lte: monthEnd },
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          lead: { select: { id: true, name: true, source: true } },
        },
      }),
      prismaClient.callIntelLead.findMany({
        where: {
          userId,
          nextFollowUpAt: { gte: monthStart, lte: monthEnd },
        },
        select: {
          id: true,
          name: true,
          source: true,
          outboundStatus: true,
          nextFollowUpAt: true,
        },
        take: 100,
      }),
      prismaClient.leadSearchBatch.findFirst({
        where: {
          userId,
          createdAt: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          leads: {
            select: {
              id: true,
              name: true,
              company: true,
              outboundStatus: true,
              website: true,
              phone: true,
            },
          },
        },
      }),
      prismaClient.callIntelMeeting.findMany({
        where: {
          userId,
          recordedAt: { gte: monthStart, lte: monthEnd },
        },
        select: {
          id: true,
          recordedAt: true,
          summary: true,
          leadId: true,
          lead: { select: { id: true, name: true } },
        },
        take: 100,
      }),
      prismaClient.callIntelSettings.findUnique({
        where: { userId },
        select: {
          calendarFilterMode: true,
          calendarKeyword: true,
        },
      }),
      prismaClient.callIntelConnection.findUnique({
        where: {
          userId_provider: { userId, provider: 'GOOGLE_CALENDAR' },
        },
        select: { credentials: true, status: true },
      }),
    ])

  let googleEvents: Array<{
    id: string
    title: string
    start: string
    htmlLink: string | null
  }> = []

  if (gcal?.status === 'ACTIVE' && gcal.credentials) {
    const refresh = decryptToken(
      (gcal.credentials as { refreshToken?: string }).refreshToken,
    )
    if (refresh) {
      try {
        const oauth = await resolveGoogleOAuthCredentials(userId)
        if (oauth) {
          const tokens = await refreshGoogleAccessToken({
            refreshToken: refresh,
            clientId: oauth.clientId,
            clientSecret: oauth.clientSecret,
          })
          const events = await listSalesEvents({
            accessToken: tokens.access_token,
            timeMin: monthStart,
            timeMax: monthEnd,
            filterMode:
              settings?.calendarFilterMode === 'KEYWORD' ? 'KEYWORD' : 'ALL',
            filterKeyword: settings?.calendarKeyword,
          })
          googleEvents = events.map((ev) => ({
            id: ev.id,
            title: ev.summary || 'Meeting',
            start: (eventStartDate(ev) || monthStart).toISOString(),
            htmlLink: ev.htmlLink || null,
          }))
        }
      } catch (err) {
        console.error('[buildLeadCalendarMonth] gcal', err)
      }
    }
  }

  void ownerEmail

  return {
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    todayBatch: todayBatch
      ? {
          id: todayBatch.id,
          location: todayBatch.location,
          niche: todayBatch.niche,
          createdAt: todayBatch.createdAt.toISOString(),
          leads: todayBatch.leads.map((l) => ({
            id: l.id,
            name: l.name,
            company: l.company,
            outboundStatus: l.outboundStatus,
            website: l.website,
            phone: l.phone,
          })),
        }
      : null,
    activities: activities.map((a) => ({
      id: a.id,
      type: a.type,
      note: a.note,
      scheduledAt: a.scheduledAt?.toISOString() || null,
      createdAt: a.createdAt.toISOString(),
      meetLink: a.meetLink,
      leadId: a.leadId,
      leadName: a.lead.name,
    })),
    followUps: followUps.map((l) => ({
      id: l.id,
      name: l.name,
      source: l.source,
      outboundStatus: l.outboundStatus,
      nextFollowUpAt: l.nextFollowUpAt!.toISOString(),
    })),
    fathomMeetings: meetings.map((m) => ({
      id: m.id,
      recordedAt: m.recordedAt.toISOString(),
      summary: m.summary,
      leadId: m.leadId,
      leadName: m.lead?.name || null,
    })),
    googleEvents,
  }
}

const getLeadListRowsCached = unstable_cache(
  async (userId: string, defaultAgentId: string | null) =>
    buildLeadListRows(userId, defaultAgentId),
  ['lead-list-rows-v1'],
  { revalidate: 20, tags: ['lead-dashboard'] },
)

const getLeadCalendarMonthCached = unstable_cache(
  async (userId: string, ownerEmail: string) =>
    buildLeadCalendarMonth(userId, ownerEmail),
  ['lead-calendar-month-v1'],
  { revalidate: 30, tags: ['lead-dashboard'] },
)

export async function getCallIntelLeadDetail(leadId: string) {
  const user = await requireUser()
  if (!user) return null

  try {
    const [lead, settings, agents, connections, llmKeys] =
      await Promise.all([
        prismaClient.callIntelLead.findFirst({
          where: { id: leadId, userId: user.id },
          include: {
            meetings: {
              orderBy: { recordedAt: 'desc' },
              take: 20,
              include: {
                scores: { orderBy: { scoredAt: 'desc' }, take: 10 },
              },
            },
            activities: {
              orderBy: { createdAt: 'desc' },
              take: 50,
            },
          },
        }),
        prismaClient.callIntelSettings.findUnique({
          where: { userId: user.id },
        }),
        prismaClient.liveKitAgent.findMany({
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, systemPrompt: true },
          take: 100,
        }),
        prismaClient.callIntelConnection.findMany({
          where: { userId: user.id },
          select: { provider: true, status: true, metadata: true },
        }),
        userHasLlmKeys(user.id),
      ])

    if (!lead) return null

    const agentNameById = new Map(agents.map((a) => [a.id, a.name]))

    const webinarIds = settings?.selectedWebinarIds || []
    const form =
      lead.source === 'BUSINESS' || isSyntheticFathomEmail(lead.email)
        ? null
        : await projectFormByEmail(user.id, lead.email, webinarIds)

    const meeting = lead.meetings[0] || null
    const meetingScores = meeting
      ? mapMeetingScores(meeting.scores, agentNameById)
      : []
    const score = meetingScores[0] || null
    const isBusiness = lead.source === 'BUSINESS'
    const emailIsSynthetic =
      isBusiness || isSyntheticFathomEmail(lead.email)
    const status = isBusiness
      ? ('No summary' as const)
      : !meeting?.summary
        ? ('No summary' as const)
        : score
          ? ('Scored' as const)
          : ('Needs score' as const)
    const kind = isBusiness
      ? ('Business' as const)
      : isSyntheticFathomEmail(lead.email)
        ? ('Instant' as const)
        : ('Calendar' as const)

    return {
      lead: {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        emailIsSynthetic,
        company: lead.company,
        notes: lead.notes,
        phone: lead.phone,
        website: lead.website,
        address: lead.address,
        source: isBusiness ? ('BUSINESS' as const) : ('MEETING' as const),
        selectedAgentId: lead.selectedAgentId || settings?.defaultAgentId || null,
        lastAppointmentAt: lead.lastAppointmentAt?.toISOString() || null,
        nextFollowUpAt: lead.nextFollowUpAt?.toISOString() || null,
        updatedAt: lead.updatedAt.toISOString(),
        kind,
        status,
        outboundStatus: lead.outboundStatus as LeadOutboundStatus,
        research: lead.webResearchJson,
        form,
        activities: lead.activities.map((a) => ({
          id: a.id,
          type: a.type,
          note: a.note,
          scheduledAt: a.scheduledAt?.toISOString() || null,
          meetLink: a.meetLink,
          createdAt: a.createdAt.toISOString(),
        })),
        meeting: meeting
          ? {
              id: meeting.id,
              summary: meeting.summary,
              recordedAt: meeting.recordedAt.toISOString(),
              fathomUrl: meeting.fathomUrl,
              score,
              scoreHistory: meetingScores.slice(1),
            }
          : null,
        meetings: lead.meetings.map((m) => {
          const scores = mapMeetingScores(m.scores, agentNameById)
          return {
            id: m.id,
            summary: m.summary,
            recordedAt: m.recordedAt.toISOString(),
            fathomUrl: m.fathomUrl,
            score: scores[0] || null,
            scoreHistory: scores.slice(1),
          }
        }),
      },
      agents,
      connections,
      hasGeminiKey: llmKeys.hasGemini,
      fathomOk: connections.some(
        (c) => c.provider === 'FATHOM' && c.status === 'ACTIVE',
      ),
      gcalOk: connections.some(
        (c) => c.provider === 'GOOGLE_CALENDAR' && c.status === 'ACTIVE',
      ),
    }
  } catch (err) {
    console.error('getCallIntelLeadDetail failed', err)
    return { unavailable: true as const }
  }
}
