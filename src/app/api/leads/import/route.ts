import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { onAuthenticateUser } from '@/actions/auth'
import { checkRateLimit } from '@/lib/embed/rateLimit'
import { importLeadRows } from '@/lib/leads/import/importLeadRows'
import {
  IMPORT_FIELDS,
  MAX_IMPORT_ROWS,
  isImportApp,
  parseImportColumnMapping,
  type MappedLeadRow,
} from '@/lib/leads/import/leadImportApps'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * The /lead/intel file import (a CSV, a Sellbird export or a Google Drive file). A route rather than
 * a server action because a few thousand rows go past the server-action body limit.
 */
export async function POST(req: NextRequest) {
  const auth = await onAuthenticateUser()
  if (!auth.user) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 })
  const userId = auth.user.id

  const limit = await checkRateLimit(`lead-import-file:${userId}`, 20, 60_000)
  if (!limit.ok) return NextResponse.json({ error: 'Too many imports. Wait a minute.' }, { status: 429 })

  const body = (await req.json().catch(() => null)) as {
    app?: unknown
    label?: unknown
    mapping?: unknown
    rows?: unknown
  } | null
  if (!body || !isImportApp(body.app)) {
    return NextResponse.json({ error: 'Pick where the file came from.' }, { status: 400 })
  }
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: 'That file has no rows.' }, { status: 400 })
  }

  const rows: MappedLeadRow[] = body.rows.slice(0, MAX_IMPORT_ROWS + 1).map((raw) => {
    const row: MappedLeadRow = {}
    if (raw && typeof raw === 'object') {
      for (const field of IMPORT_FIELDS) {
        const value = (raw as Record<string, unknown>)[field]
        if (typeof value === 'string') row[field] = value
      }
    }
    return row
  })

  try {
    const result = await importLeadRows({
      userId,
      app: body.app,
      label: typeof body.label === 'string' ? body.label : 'Import',
      rows,
      mapping: parseImportColumnMapping(body.mapping),
    })
    revalidatePath('/lead', 'layout')
    revalidateTag('lead-dashboard')
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[lead-import file]', err)
    return NextResponse.json({ error: 'The import failed. Try again.' }, { status: 500 })
  }
}
