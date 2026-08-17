/**
 * Coolify/VPS scrape-agent supervisor: start Python when needed, enrich, kill.
 * Enabled when SCRAPE_AGENT_MANAGED=1 (or true/yes).
 */

import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import {
  enrichWebsiteViaScrapeAgent,
  isScrapeAgentConfigured,
  type ScrapeEnrichResult,
} from '@/lib/leads/scrapeAgentClient'
import {
  applyWebsiteEnrichmentToLead,
  enrichLeadWebsiteSync,
  leadNeedsWebsiteScrape,
} from '@/lib/leads/enrichLeadWebsite'
import { prismaClient } from '@/lib/prismaClient'
import { resolveUserGeminiApiKey } from '@/lib/leads/resolveUserLlmKey'

const DEFAULT_URL = 'http://127.0.0.1:8100'
const HEALTH_TIMEOUT_MS = 2_000
const READY_TIMEOUT_MS = 60_000
const READY_POLL_MS = 500

let childProcess: ChildProcess | null = null
let startedByUs = false
let mutex: Promise<void> = Promise.resolve()

function isManaged(): boolean {
  const raw = (process.env.SCRAPE_AGENT_MANAGED || '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

function agentBaseUrl(): string {
  const raw = process.env.SCRAPE_AGENT_URL?.trim()
  if (raw) return raw.replace(/\/$/, '')
  if (isManaged()) return DEFAULT_URL
  return DEFAULT_URL
}

function agentCwd(): string {
  const fromEnv = process.env.SCRAPE_AGENT_CWD?.trim()
  if (fromEnv) return fromEnv
  return path.join(process.cwd(), 'agents/python/scrape-agent')
}

async function healthOk(baseUrl: string): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS)
  try {
    const res = await fetch(`${baseUrl}/health`, { signal: controller.signal })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

async function waitUntilReady(baseUrl: string): Promise<boolean> {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (await healthOk(baseUrl)) return true
    await new Promise((r) => setTimeout(r, READY_POLL_MS))
  }
  return false
}

function spawnAgent(): ChildProcess {
  const cwd = agentCwd()
  const custom = process.env.SCRAPE_AGENT_CMD?.trim()
  const cmd = custom ? custom.split(/\s+/)[0]! : 'uv'
  const args = custom
    ? custom.split(/\s+/).slice(1)
    : ['run', 'python', '-m', 'agent.main']

  const child = spawn(cmd, args, {
    cwd,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: process.env.SCRAPE_AGENT_PORT?.trim() || '8100',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  })

  child.stdout?.on('data', (buf: Buffer) => {
    const line = buf.toString().trim()
    if (line) console.info('[scrape-agent]', line)
  })
  child.stderr?.on('data', (buf: Buffer) => {
    const line = buf.toString().trim()
    if (line) console.warn('[scrape-agent]', line)
  })
  child.on('exit', (code, signal) => {
    console.info('[scrape-agent] exited', { code, signal })
    if (childProcess === child) {
      childProcess = null
      startedByUs = false
    }
  })

  return child
}

async function ensureAgentRunning(): Promise<{
  baseUrl: string
  owned: boolean
}> {
  const baseUrl = agentBaseUrl()

  if (await healthOk(baseUrl)) {
    return { baseUrl, owned: false }
  }

  if (!isManaged()) {
    throw new Error(
      'Scrape agent is not running. Set SCRAPE_AGENT_MANAGED=1 on Coolify/VPS or start agents/python/scrape-agent.',
    )
  }

  if (!childProcess || childProcess.killed) {
    childProcess = spawnAgent()
    startedByUs = true
  }

  const ready = await waitUntilReady(baseUrl)
  if (!ready) {
    await stopAgentIfOwned()
    throw new Error('Scrape agent failed to become ready')
  }

  return { baseUrl, owned: startedByUs }
}

async function stopAgentIfOwned(): Promise<void> {
  if (!startedByUs || !childProcess) return
  const child = childProcess
  startedByUs = false
  childProcess = null

  try {
    child.kill('SIGTERM')
  } catch {
    /* ignore */
  }

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      try {
        child.kill('SIGKILL')
      } catch {
        /* ignore */
      }
      resolve()
    }, 5_000)
    child.once('exit', () => {
      clearTimeout(timeout)
      resolve()
    })
  })
}

function withMutex<T>(fn: () => Promise<T>): Promise<T> {
  const run = mutex.then(fn, fn)
  mutex = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

/**
 * True when we can call the agent (URL set, or managed local supervisor).
 */
export function canUseScrapeAgent(): boolean {
  return isScrapeAgentConfigured() || isManaged()
}

/**
 * Ensure agent is up (spawn if managed), run work, then kill if we started it.
 */
export async function withScrapeAgent<T>(
  work: (baseUrl: string) => Promise<T>,
): Promise<T> {
  return withMutex(async () => {
    const prevUrl = process.env.SCRAPE_AGENT_URL
    let owned = false
    try {
      const session = await ensureAgentRunning()
      owned = session.owned
      if (!process.env.SCRAPE_AGENT_URL?.trim() && isManaged()) {
        process.env.SCRAPE_AGENT_URL = session.baseUrl
      }
      return await work(session.baseUrl)
    } finally {
      if (owned) await stopAgentIfOwned()
      if (!prevUrl && isManaged()) {
        // keep URL for subsequent HTTP helpers in same tick if needed
      }
    }
  })
}

export type BatchScrapeTarget = {
  leadId: string
  userId: string
  website: string
  name?: string | null
  company?: string | null
}

/**
 * Start agent if needed, sync-scrape each target, apply enrichment, stop agent.
 */
export async function scrapeLeadWebsitesManaged(
  targets: BatchScrapeTarget[],
): Promise<{ scraped: number; failed: number; errors: string[] }> {
  const withSites = targets.filter((t) => t.website?.trim())
  if (withSites.length === 0) {
    return { scraped: 0, failed: 0, errors: [] }
  }

  if (!canUseScrapeAgent()) {
    return {
      scraped: 0,
      failed: withSites.length,
      errors: ['Scrape agent not configured'],
    }
  }

  return withScrapeAgent(async () => {
    let scraped = 0
    let failed = 0
    const errors: string[] = []

    for (const target of withSites) {
      const geminiApiKey = await resolveUserGeminiApiKey(target.userId)
      const lead = await prismaClient.callIntelLead.findFirst({
        where: { id: target.leadId, userId: target.userId },
        select: { webResearchJson: true, website: true, name: true, company: true },
      })
      if (!lead || !leadNeedsWebsiteScrape({ ...lead, website: target.website })) {
        continue
      }

      const result = await enrichLeadWebsiteSync({
        leadId: target.leadId,
        userId: target.userId,
        website: target.website,
        name: target.name ?? lead.name,
        company: target.company ?? lead.company,
        geminiApiKey,
        existingResearch: lead.webResearchJson,
      })

      if (!result.ok) {
        failed++
        errors.push(`${target.leadId}: ${result.error}`)
        continue
      }

      await prismaClient.callIntelLead.update({
        where: { id: target.leadId },
        data: { webResearchJson: result.dossier as object },
      })
      scraped++
    }

    return { scraped, failed, errors }
  })
}

/**
 * Ensure scrape for a single lead (profile open / manual fallback path).
 */
export async function ensureLeadWebsiteScraped(options: {
  leadId: string
  userId: string
}): Promise<
  | { ok: true; scraped: boolean }
  | { ok: false; error: string }
> {
  const lead = await prismaClient.callIntelLead.findFirst({
    where: { id: options.leadId, userId: options.userId },
    select: {
      id: true,
      website: true,
      name: true,
      company: true,
      webResearchJson: true,
      source: true,
    },
  })
  if (!lead) return { ok: false, error: 'Lead not found' }
  if (!lead.website?.trim()) return { ok: true, scraped: false }
  if (!leadNeedsWebsiteScrape(lead)) return { ok: true, scraped: false }
  if (!canUseScrapeAgent()) {
    return { ok: false, error: 'Scrape agent not configured' }
  }

  const outcome = await scrapeLeadWebsitesManaged([
    {
      leadId: lead.id,
      userId: options.userId,
      website: lead.website,
      name: lead.name,
      company: lead.company,
    },
  ])

  if (outcome.failed > 0 && outcome.scraped === 0) {
    return { ok: false, error: outcome.errors[0] || 'Scrape failed' }
  }
  return { ok: true, scraped: outcome.scraped > 0 }
}

/** Re-export for callers that applied raw enrich results */
export async function applyManagedEnrichResult(options: {
  leadId: string
  userId: string
  result: ScrapeEnrichResult
}): Promise<void> {
  await applyWebsiteEnrichmentToLead(options)
}
