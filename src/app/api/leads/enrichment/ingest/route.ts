import { NextRequest, NextResponse } from 'next/server'
import { applyWebsiteEnrichmentToLead } from '@/lib/leads/enrichLeadWebsite'
import type { ScrapeEnrichResult } from '@/lib/leads/scrapeAgentClient'

export const runtime = 'nodejs'
export const maxDuration = 60

function authorize(req: NextRequest): boolean {
  const expected =
    process.env.SCRAPE_AGENT_API_KEY?.trim() ||
    process.env.N8N_API_KEY?.trim() ||
    ''
  if (!expected) return false
  const header = req.headers.get('x-api-key') || ''
  const auth = req.headers.get('authorization') || ''
  const bearer = auth.toLowerCase().startsWith('bearer ')
    ? auth.slice(7).trim()
    : ''
  return header === expected || bearer === expected
}

/**
 * Callback from the Python scrape worker (async enrich jobs).
 */
export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await req.json()) as ScrapeEnrichResult
    const leadId = body.leadId?.trim()
    const userId = body.userId?.trim()
    if (!leadId || !userId) {
      return NextResponse.json(
        { error: 'leadId and userId are required' },
        { status: 400 },
      )
    }

    if (!body.enrichment) {
      return NextResponse.json(
        { error: 'enrichment payload missing' },
        { status: 400 },
      )
    }

    await applyWebsiteEnrichmentToLead({
      leadId,
      userId,
      result: {
        ...body,
        ok: body.ok !== false,
        provider: 'scrapegraph-ai',
        scrapedAt: body.scrapedAt || new Date().toISOString(),
        url: body.url,
        enrichment: body.enrichment,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[leads/enrichment/ingest]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
