import { Prisma } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import {
  enrichWebsiteViaScrapeAgent,
  enqueueWebsiteEnrichment,
  isScrapeAgentConfigured,
  toLeadWebsiteEnrichment,
  type LeadWebsiteEnrichment,
  type ScrapeEnrichResult,
} from '@/lib/leads/scrapeAgentClient'
import type { WebResearchDossier } from '@/lib/leads/webResearch'

function asDossier(value: unknown): WebResearchDossier | null {
  if (!value || typeof value !== 'object') return null
  return value as WebResearchDossier
}

export function mergeWebsiteEnrichmentIntoDossier(
  existing: unknown,
  enrichment: LeadWebsiteEnrichment,
  fallbackQuery: string,
): WebResearchDossier {
  const base = asDossier(existing)
  const flags = [
    ...(enrichment.flags || []),
    ...(base?.flags || []),
  ].slice(0, 12)
  const highlights = [
    ...(enrichment.highlights || []),
    ...(enrichment.companySummary ? [enrichment.companySummary] : []),
    ...(base?.highlights || []),
  ].slice(0, 12)

  const sources = [...(base?.sources || [])]
  if (enrichment.url && !sources.some((s) => s.link === enrichment.url)) {
    sources.unshift({
      title: 'Company website (scraped)',
      link: enrichment.url,
      snippet: enrichment.companySummary || '',
    })
  }

  return {
    query: base?.query || fallbackQuery,
    flags,
    highlights,
    sources,
    locationGuess: base?.locationGuess ?? null,
    generatedAt: new Date().toISOString(),
    provider: base?.provider || 'scrapegraph',
    websiteEnrichment: enrichment,
  }
}

export async function applyWebsiteEnrichmentToLead(options: {
  leadId: string
  userId: string
  result: ScrapeEnrichResult
}): Promise<void> {
  const lead = await prismaClient.callIntelLead.findFirst({
    where: { id: options.leadId, userId: options.userId },
    select: {
      id: true,
      name: true,
      company: true,
      website: true,
      webResearchJson: true,
    },
  })
  if (!lead) return

  const enrichment = toLeadWebsiteEnrichment(options.result)
  const dossier = mergeWebsiteEnrichmentIntoDossier(
    lead.webResearchJson,
    enrichment,
    [lead.name, lead.company, lead.website].filter(Boolean).join(' '),
  )

  await prismaClient.callIntelLead.update({
    where: { id: lead.id },
    data: { webResearchJson: dossier as unknown as Prisma.InputJsonValue },
  })
}

/**
 * Sync scrape for a single lead website. No-op if agent URL unset or no website.
 */
export async function enrichLeadWebsiteSync(options: {
  leadId: string
  userId: string
  website: string
  name?: string | null
  company?: string | null
  geminiApiKey?: string | null
  existingResearch?: unknown
}): Promise<
  | { ok: true; dossier: WebResearchDossier }
  | { ok: false; error: string; skipped?: boolean }
> {
  const scraped = await enrichWebsiteViaScrapeAgent({
    url: options.website,
    leadId: options.leadId,
    userId: options.userId,
    name: options.name,
    company: options.company,
    geminiApiKey: options.geminiApiKey,
  })

  if (!scraped.ok) {
    return {
      ok: false,
      error: scraped.error,
      skipped: scraped.skipped,
    }
  }

  const enrichment = toLeadWebsiteEnrichment(scraped.data)
  const dossier = mergeWebsiteEnrichmentIntoDossier(
    options.existingResearch,
    enrichment,
    [options.name, options.company, options.website].filter(Boolean).join(' '),
  )

  return { ok: true, dossier }
}

export async function enqueueLeadWebsiteEnrichment(options: {
  leadId: string
  userId: string
  website: string
  name?: string | null
  company?: string | null
  geminiApiKey?: string | null
}): Promise<{ ok: true } | { ok: false; error: string; skipped?: boolean }> {
  if (!isScrapeAgentConfigured()) {
    return { ok: false, skipped: true, error: 'SCRAPE_AGENT_URL not set' }
  }

  const origin = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.SAAS_API_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '')

  return enqueueWebsiteEnrichment({
    url: options.website,
    leadId: options.leadId,
    userId: options.userId,
    name: options.name,
    company: options.company,
    geminiApiKey: options.geminiApiKey,
    callbackUrl: `${origin}/api/leads/enrichment/ingest`,
  })
}

export function leadNeedsWebsiteScrape(lead: {
  website?: string | null
  webResearchJson?: unknown
  source?: string | null
}): boolean {
  if (!lead.website?.trim()) return false
  const dossier = asDossier(lead.webResearchJson)
  return !dossier?.websiteEnrichment?.scrapedAt
}
