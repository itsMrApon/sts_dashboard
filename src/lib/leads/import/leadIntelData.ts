import 'server-only'
import { prismaClient } from '@/lib/prismaClient'
import { decryptToken } from '@/lib/messages/encrypt'
import { resolveSerperApiKey } from '@/lib/leads/webResearch'
import { isDatabaseConnectivityError, logDatabaseConnectivityFailure } from '@/lib/prismaErrors'
import { parseImportColumnMapping, type ImportApp, type ImportColumnMapping } from './leadImportApps'
import { findN8nConnector } from './n8nScripts'

/** What /lead/intel renders. Loaded on the server for the signed-in user only. */

export function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_STS_AI_URL?.replace(/\/$/, '') ||
    'http://localhost:3000'
  )
}

export type LeadIntelBatch = {
  id: string
  app: ImportApp
  label: string
  rowCount: number
  created: number
  matched: number
  skipped: number
  createdAt: string
}

export type LeadIntelData = {
  /** Saved column mapping per import app, reused when the next file from it comes in. */
  mappings: Partial<Record<ImportApp, ImportColumnMapping>>
  lastImportAt: Partial<Record<ImportApp, string>>
  /** n8n is connected on /integrations (an MCP connector); the webhook is the push alternative. */
  n8n: { connected: boolean; webhookUrl: string | null }
  fathom: { connected: boolean; meetings: number; lastCallAt: string | null }
  /** What the Find dialog needs. */
  maps: {
    serperConfigured: boolean
    leads: number
    location: string
    niche: string
    recentSearches: Array<{ location: string; niche: string }>
  }
  batches: LeadIntelBatch[]
}

export async function getLeadIntelData(userId: string): Promise<LeadIntelData | { unavailable: true }> {
  try {
    const [
      settings,
      sources,
      batches,
      fathomConn,
      meetingStats,
      mapsLeads,
      searches,
      serperKey,
      n8nConnector,
    ] =
      await Promise.all([
        prismaClient.callIntelSettings.findUnique({
          where: { userId },
          select: { businessLocation: true, businessNiche: true },
        }),
        prismaClient.leadImportSource.findMany({ where: { userId } }),
        prismaClient.leadImportBatch.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 4,
        }),
        prismaClient.callIntelConnection.findUnique({
          where: { userId_provider: { userId, provider: 'FATHOM' } },
          select: { status: true },
        }),
        prismaClient.callIntelMeeting.aggregate({
          where: { userId },
          _count: { _all: true },
          _max: { recordedAt: true },
        }),
        prismaClient.callIntelLead.count({ where: { userId, source: 'BUSINESS' } }),
        prismaClient.leadSearchBatch.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 12,
          select: { location: true, niche: true },
        }),
        resolveSerperApiKey(userId),
        findN8nConnector(userId),
      ])

    const mappings: LeadIntelData['mappings'] = {}
    const lastImportAt: LeadIntelData['lastImportAt'] = {}
    let webhookUrl: string | null = null
    for (const source of sources) {
      const app = source.app as ImportApp
      mappings[app] = parseImportColumnMapping(source.mapping)
      if (source.lastImportAt) lastImportAt[app] = source.lastImportAt.toISOString()
      if (app === 'N8N') {
        const token = decryptToken(source.webhookTokenEnc)
        if (token) webhookUrl = `${appBaseUrl()}/api/leads/import/${token}`
      }
    }

    const seen = new Set<string>()
    const recentSearches = searches.filter((s) => {
      const key = `${s.niche}|${s.location}`.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return {
      mappings,
      lastImportAt,
      n8n: { connected: Boolean(n8nConnector), webhookUrl },
      fathom: {
        connected: fathomConn?.status === 'ACTIVE',
        meetings: meetingStats._count._all,
        lastCallAt: meetingStats._max.recordedAt?.toISOString() || null,
      },
      maps: {
        serperConfigured: Boolean(serperKey),
        leads: mapsLeads,
        location: settings?.businessLocation?.trim() || '',
        niche: settings?.businessNiche?.trim() || '',
        recentSearches: recentSearches.slice(0, 6),
      },
      batches: batches.map((b) => ({
        id: b.id,
        app: b.app as ImportApp,
        label: b.label,
        rowCount: b.rowCount,
        created: b.createdCount,
        matched: b.updatedCount,
        skipped: b.skippedCount,
        createdAt: b.createdAt.toISOString(),
      })),
    }
  } catch (err) {
    if (isDatabaseConnectivityError(err)) {
      logDatabaseConnectivityFailure('getLeadIntelData', err)
      return { unavailable: true }
    }
    throw err
  }
}
