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

export type LeadWebsiteEnrichment = WebsiteEnrichmentPayload & {
  url: string
  scrapedAt: string
  provider: 'scrapegraph-ai'
  error?: string | null
}

function isManagedScrapeAgent(): boolean {
  const raw = (process.env.SCRAPE_AGENT_MANAGED || '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

function scrapeAgentBaseUrl(): string | null {
  const raw = process.env.SCRAPE_AGENT_URL?.trim()
  if (raw) return raw.replace(/\/$/, '')
  // Coolify/VPS supervisor defaults to local agent when managed
  if (isManagedScrapeAgent()) return 'http://127.0.0.1:8100'
  return null
}

function scrapeAgentApiKey(): string {
  return process.env.SCRAPE_AGENT_API_KEY?.trim() || ''
}

export function isScrapeAgentConfigured(): boolean {
  return Boolean(scrapeAgentBaseUrl())
}

export async function enrichWebsiteViaScrapeAgent(options: {
  url: string
  leadId?: string
  userId?: string
  name?: string | null
  company?: string | null
  geminiApiKey?: string | null
  /** Default 120s — scrapes are slow */
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
        ...(scrapeAgentApiKey()
          ? { 'x-api-key': scrapeAgentApiKey() }
          : {}),
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
      return {
        ok: false,
        error: detail || `Scrape agent HTTP ${res.status}`,
      }
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

/**
 * Fire-and-forget: worker scrapes then POSTs to Next.js ingest callback.
 */
export async function enqueueWebsiteEnrichment(options: {
  url: string
  leadId: string
  userId: string
  name?: string | null
  company?: string | null
  geminiApiKey?: string | null
  callbackUrl: string
}): Promise<{ ok: true } | { ok: false; error: string; skipped?: boolean }> {
  const base = scrapeAgentBaseUrl()
  if (!base) {
    return {
      ok: false,
      skipped: true,
      error: 'SCRAPE_AGENT_URL not set',
    }
  }

  try {
    const res = await fetch(`${base}/enrich/async`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(scrapeAgentApiKey()
          ? { 'x-api-key': scrapeAgentApiKey() }
          : {}),
      },
      body: JSON.stringify({
        url: options.url,
        leadId: options.leadId,
        userId: options.userId,
        name: options.name || undefined,
        company: options.company || undefined,
        geminiApiKey: options.geminiApiKey || undefined,
        callbackUrl: options.callbackUrl,
        callbackApiKey: scrapeAgentApiKey() || undefined,
      }),
    })

    if (res.status !== 202 && !res.ok) {
      const text = await res.text().catch(() => '')
      return {
        ok: false,
        error: text.slice(0, 200) || `Scrape agent HTTP ${res.status}`,
      }
    }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Enqueue failed',
    }
  }
}

export function toLeadWebsiteEnrichment(
  result: ScrapeEnrichResult,
): LeadWebsiteEnrichment {
  const e = result.enrichment || {}
  const base: LeadWebsiteEnrichment = {
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
  return normalizeWebsiteEnrichment(base) || base
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim()
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>
        for (const key of ['name', 'title', 'service', 'label', 'value', 'url', 'link']) {
          const v = record[key]
          if (typeof v === 'string' && v.trim()) return v.trim()
        }
      }
      return ''
    })
    .filter(Boolean)
}

/**
 * ScrapeGraphAI often returns fields nested under raw.content when the
 * worker didn't unwrap them. Lift nested values into top-level fields.
 */
export function normalizeWebsiteEnrichment(
  enrichment: LeadWebsiteEnrichment | null | undefined,
): LeadWebsiteEnrichment | null {
  if (!enrichment) return null

  const raw = enrichment.raw
  let nested: Record<string, unknown> | null = null
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const root = raw as Record<string, unknown>
    const content = root.content
    if (content && typeof content === 'object' && !Array.isArray(content)) {
      nested = content as Record<string, unknown>
    } else if (
      typeof root.companySummary === 'string' ||
      Array.isArray(root.services)
    ) {
      nested = root
    }
  }

  const pickString = (...values: unknown[]) => {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
    return null
  }

  const companySummary =
    pickString(enrichment.companySummary, nested?.companySummary, nested?.summary) ||
    null

  return {
    ...enrichment,
    companySummary,
    services:
      (enrichment.services?.length ?? 0) > 0
        ? enrichment.services || []
        : asStringList(nested?.services ?? nested?.products),
    contactEmails:
      (enrichment.contactEmails?.length ?? 0) > 0
        ? enrichment.contactEmails || []
        : asStringList(nested?.contactEmails ?? nested?.emails),
    contactPhones:
      (enrichment.contactPhones?.length ?? 0) > 0
        ? enrichment.contactPhones || []
        : asStringList(nested?.contactPhones ?? nested?.phones),
    socialLinks:
      (enrichment.socialLinks?.length ?? 0) > 0
        ? enrichment.socialLinks || []
        : asStringList(nested?.socialLinks ?? nested?.socials),
    highlights:
      (enrichment.highlights?.length ?? 0) > 0
        ? enrichment.highlights || []
        : asStringList(nested?.highlights),
    flags:
      (enrichment.flags?.length ?? 0) > 0
        ? enrichment.flags || []
        : asStringList(nested?.flags),
  }
}
