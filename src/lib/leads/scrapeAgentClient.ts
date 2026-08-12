/**
 * HTTP client for the Python ScrapeGraphAI worker
 * (agents/python/scrape-agent).
 */

export type WebsiteEnrichmentPayload = {
  companySummary?: string | null
  services?: string[]
  contactEmails?: string[]
  contactPhones?: string[]
  socialLinks?: string[]
  highlights?: string[]
  flags?: string[]
  raw?: unknown
}

export type ScrapeEnrichResult = {
  ok: boolean
  url: string
  leadId?: string | null
  userId?: string | null
  enrichment: WebsiteEnrichmentPayload
  scrapedAt: string
  provider: 'scrapegraph-ai'
  error?: string | null
}

export type LeadWebsiteScrape = WebsiteEnrichmentPayload & {
  url: string
  scrapedAt: string
  provider: 'scrapegraph-ai'
  error?: string | null
}

function scrapeAgentBaseUrl(): string | null {
  const raw = process.env.SCRAPE_AGENT_URL?.trim()
  if (!raw) return null
  return raw.replace(/\/$/, '')
}

function scrapeAgentApiKey(): string {
  return process.env.SCRAPE_AGENT_API_KEY?.trim() || ''
}

export function isScrapeAgentConfigured(): boolean {
  return Boolean(scrapeAgentBaseUrl())
}

export function toLeadWebsiteScrape(
  result: ScrapeEnrichResult,
): LeadWebsiteScrape {
  const e = result.enrichment || {}
  return {
    url: result.url,
    scrapedAt: result.scrapedAt || new Date().toISOString(),
    provider: 'scrapegraph-ai',
    error: result.error || null,
    companySummary: e.companySummary ?? null,
    services: e.services || [],
    contactEmails: e.contactEmails || [],
    contactPhones: e.contactPhones || [],
    socialLinks: e.socialLinks || [],
    highlights: e.highlights || [],
    flags: e.flags || [],
    raw: e.raw,
  }
}

export async function enrichWebsiteViaScrapeAgent(options: {
  url: string
  leadId?: string
  userId?: string
  name?: string | null
  company?: string | null
  geminiApiKey?: string | null
  timeoutMs?: number
}): Promise<
  | { ok: true; data: ScrapeEnrichResult }
  | { ok: false; error: string; skipped?: boolean }
> {
  const base = scrapeAgentBaseUrl()
  if (!base) {
    return {
      ok: false,
      skipped: true,
      error:
        'SCRAPE_AGENT_URL not set. Start agents/python/scrape-agent and set the env var.',
    }
  }

  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? 120_000
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${base}/enrich`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(scrapeAgentApiKey() ? { 'x-api-key': scrapeAgentApiKey() } : {}),
      },
      body: JSON.stringify({
        url: options.url,
        leadId: options.leadId,
        userId: options.userId,
        name: options.name || undefined,
        company: options.company || undefined,
        geminiApiKey: options.geminiApiKey || undefined,
      }),
      signal: controller.signal,
    })

    const data = (await res.json().catch(() => null)) as
      | ScrapeEnrichResult
      | { detail?: string; error?: string }
      | null

    if (!res.ok) {
      const detail =
        data && typeof data === 'object'
          ? 'detail' in data
            ? String(data.detail || '')
            : 'error' in data
              ? String(data.error || '')
              : ''
          : ''
      return { ok: false, error: detail || `Scrape agent HTTP ${res.status}` }
    }

    if (!data || typeof data !== 'object' || !('enrichment' in data)) {
      return { ok: false, error: 'Invalid scrape agent response' }
    }

    return { ok: true, data: data as ScrapeEnrichResult }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'Scrape agent timed out' }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Scrape agent request failed',
    }
  } finally {
    clearTimeout(timer)
  }
}
