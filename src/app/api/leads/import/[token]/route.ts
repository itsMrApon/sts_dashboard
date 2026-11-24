import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { checkRateLimit } from '@/lib/embed/rateLimit'
import { importLeadRows } from '@/lib/leads/import/importLeadRows'
import { parseImportColumnMapping, IMPORT_FIELDS } from '@/lib/leads/import/leadImportApps'
import {
  guessColumnMapping,
  hashWebhookToken,
  recordsFromPayload,
  sampleColumns,
} from '@/lib/leads/import/webhookImport'

export const runtime = 'nodejs'

/** Bigger pushes should be split by the workflow; this keeps one request bounded. */
const MAX_BODY_BYTES = 1_000_000
const MAX_RECORDS = 500

/**
 * n8n / Zapier / Make send leads here. The token in the URL is the only credential, so it is long,
 * random and looked up by hash. The columns are matched with the mapping saved for n8n on
 * /lead/intel, or guessed from the key names the first time.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token || token.length < 20) return NextResponse.json({ error: 'Unknown webhook' }, { status: 404 })

  const source = await prismaClient.leadImportSource.findUnique({
    where: { webhookTokenHash: hashWebhookToken(token) },
    select: { id: true, userId: true, app: true, mapping: true },
  })
  if (!source || source.app !== 'N8N') return NextResponse.json({ error: 'Unknown webhook' }, { status: 404 })

  const limit = await checkRateLimit(`lead-import:${source.id}`, 60, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many pushes. Wait a minute.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    )
  }

  const text = await req.text()
  if (text.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: `Send at most ${MAX_RECORDS} leads (1 MB) per push.` }, { status: 413 })
  }
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Send JSON: one lead, or an array of leads.' }, { status: 400 })
  }

  const records = recordsFromPayload(body).slice(0, MAX_RECORDS)
  if (records.length === 0) return NextResponse.json({ error: 'No leads in that push.' }, { status: 400 })

  const columns = sampleColumns(records)
  const headers = columns.map((c) => c.name)
  const saved = parseImportColumnMapping(source.mapping)
  // A saved mapping wins; fields it doesn't cover (or keys that changed) fall back to the guess.
  const guessed = guessColumnMapping(headers)
  const mapping = { ...guessed }
  for (const field of IMPORT_FIELDS) {
    const header = saved[field]
    if (header && headers.includes(header)) mapping[field] = header
  }

  const rows = records.map((record) => {
    const row: Record<string, string> = {}
    for (const field of IMPORT_FIELDS) {
      const header = mapping[field]
      if (header && record[header]) row[field] = record[header]
    }
    return row
  })

  try {
    const result = await importLeadRows({
      userId: source.userId,
      app: 'N8N',
      label: records.length === 1 ? 'Webhook push · 1 lead' : `Webhook push · ${records.length} leads`,
      rows,
      lastColumns: columns as unknown as Prisma.InputJsonValue,
    })
    // New leads show in List and on the calendar strip right away, not after the cache expires.
    revalidatePath('/lead', 'layout')
    revalidateTag('lead-dashboard')
    return NextResponse.json({
      ok: true,
      created: result.created,
      matched: result.updated,
      skipped: result.skipped,
    })
  } catch (err) {
    console.error('[lead-import webhook]', err)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
