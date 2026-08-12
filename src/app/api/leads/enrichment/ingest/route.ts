import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import {
  toLeadWebsiteScrape,
  type ScrapeEnrichResult,
} from '@/lib/leads/scrapeAgentClient'

export const runtime = 'nodejs'

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

/** Callback from Python scrape worker (async jobs). */
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

    const lead = await prismaClient.huntedLead.findFirst({
      where: { id: leadId, userId },
      select: { id: true },
    })
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const snapshot = toLeadWebsiteScrape({
      ...body,
      ok: body.ok !== false,
      provider: 'scrapegraph-ai',
      scrapedAt: body.scrapedAt || new Date().toISOString(),
      url: body.url,
      enrichment: body.enrichment || {},
    })

    await prismaClient.huntedLead.update({
      where: { id: lead.id },
      data: {
        websiteScrapeJson: snapshot as unknown as Prisma.InputJsonValue,
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
