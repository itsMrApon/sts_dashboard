/**
 * Pull up to 10 new Serper Maps businesses and attach a LeadSearchBatch.
 * Scraping is optional: cron (7am) scrapes the batch; manual refresh does not.
 */

import type { LeadSearchBatchSource } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { ingestBusinessLeadForUser } from '@/lib/leads/ingestBusinessLead'
import { searchSerperMaps } from '@/lib/leads/serperMaps'
import { scrapeLeadWebsitesManaged } from '@/lib/leads/scrapeAgentSupervisor'

export const BUSINESS_BATCH_SIZE = 10
export const LEAD_BATCH_HISTORY_DAYS = 7

export type CreateBusinessLeadBatchResult = {
  batchId: string
  count: number
  created: number
  scraped: number
  scrapeFailed: number
  location: string
  niche: string
}

function dayStart(d = new Date()): Date {
  const start = new Date(d)
  start.setHours(0, 0, 0, 0)
  return start
}

export async function hasCronBatchToday(userId: string): Promise<boolean> {
  const existing = await prismaClient.leadSearchBatch.findFirst({
    where: {
      userId,
      source: 'CRON',
      createdAt: { gte: dayStart() },
    },
    select: { id: true },
  })
  return Boolean(existing)
}

export async function pruneOldLeadSearchBatches(userId: string): Promise<void> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - LEAD_BATCH_HISTORY_DAYS)

  const oldBatches = await prismaClient.leadSearchBatch.findMany({
    where: { userId, createdAt: { lt: cutoff } },
    select: { id: true },
  })
  if (oldBatches.length === 0) return

  const ids = oldBatches.map((b) => b.id)
  await prismaClient.callIntelLead.updateMany({
    where: { userId, searchBatchId: { in: ids } },
    data: { searchBatchId: null },
  })
  await prismaClient.leadSearchBatch.deleteMany({
    where: { id: { in: ids } },
  })
}

export async function listRecentLeadSearchBatches(userId: string) {
  await pruneOldLeadSearchBatches(userId)
  const batches = await prismaClient.leadSearchBatch.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: LEAD_BATCH_HISTORY_DAYS,
    select: {
      id: true,
      location: true,
      niche: true,
      source: true,
      createdAt: true,
      _count: { select: { leads: true } },
    },
  })
  return batches.map((b) => ({
    id: b.id,
    location: b.location,
    niche: b.niche,
    source: b.source,
    createdAt: b.createdAt.toISOString(),
    leadCount: b._count.leads,
  }))
}

/**
 * Create a new batch of up to 10 never-seen (or still NEW & unbatched) Maps leads.
 * Pass scrape: false for fast manual refresh; cron should scrape: true.
 */
export async function createBusinessLeadBatch(options: {
  userId: string
  location: string
  niche: string
  apiKey: string
  source: LeadSearchBatchSource
  defaultAgentId?: string | null
  /** Default true. Manual Business refresh should set false. */
  scrape?: boolean
}): Promise<CreateBusinessLeadBatchResult> {
  const location = options.location.trim()
  const niche = options.niche.trim()
  if (!location || !niche) {
    throw new Error('Location and niche are required')
  }
  const shouldScrape = options.scrape !== false

  await pruneOldLeadSearchBatches(options.userId)

  // Fetch a wider pool so we can skip already-known / in-progress / done places
  const places = await searchSerperMaps({
    apiKey: options.apiKey,
    niche,
    location,
    limit: 20,
  })

  const placeIds = places.map((p) => p.placeId).filter(Boolean)
  const existing = placeIds.length
    ? await prismaClient.callIntelLead.findMany({
        where: {
          userId: options.userId,
          source: 'BUSINESS',
          placeId: { in: placeIds },
        },
        select: {
          id: true,
          placeId: true,
          outboundStatus: true,
          searchBatchId: true,
          website: true,
          name: true,
          company: true,
        },
      })
    : []

  const byPlace = new Map(existing.map((e) => [e.placeId || '', e]))

  const selected: typeof places = []
  for (const place of places) {
    if (selected.length >= BUSINESS_BATCH_SIZE) break
    const prior = byPlace.get(place.placeId)
    if (!prior) {
      selected.push(place)
      continue
    }
    // Never re-serve leads already being worked or done
    if (prior.outboundStatus === 'ON_PROCESS' || prior.outboundStatus === 'DONE') {
      continue
    }
    // Skip if already attached to a recent batch
    if (prior.searchBatchId) continue
    selected.push(place)
  }

  if (selected.length === 0) {
    throw new Error(
      'No new Maps businesses found (all results already saved or outreached). Try a different location/type.',
    )
  }

  const batch = await prismaClient.leadSearchBatch.create({
    data: {
      userId: options.userId,
      location,
      niche,
      source: options.source,
    },
    select: { id: true },
  })

  let created = 0
  const leadTargets: Array<{
    leadId: string
    website: string | null
    name: string
    company: string | null
  }> = []

  for (const place of selected) {
    const result = await ingestBusinessLeadForUser({
      userId: options.userId,
      place,
      defaultAgentId: options.defaultAgentId || null,
    })
    if (result.created) created++

    await prismaClient.callIntelLead.update({
      where: { id: result.leadId },
      data: {
        searchBatchId: batch.id,
        outboundStatus: 'NEW',
        source: 'BUSINESS',
      },
    })

    leadTargets.push({
      leadId: result.leadId,
      website: place.website,
      name: place.title,
      company: place.title,
    })
  }

  if (!shouldScrape) {
    return {
      batchId: batch.id,
      count: leadTargets.length,
      created,
      scraped: 0,
      scrapeFailed: 0,
      location,
      niche,
    }
  }

  const scrapeTargets = leadTargets
    .filter((t) => t.website?.trim())
    .map((t) => ({
      leadId: t.leadId,
      userId: options.userId,
      website: t.website!.trim(),
      name: t.name,
      company: t.company,
    }))

  const scrape = await scrapeLeadWebsitesManaged(scrapeTargets)

  return {
    batchId: batch.id,
    count: leadTargets.length,
    created,
    scraped: scrape.scraped,
    scrapeFailed: scrape.failed,
    location,
    niche,
  }
}
