import 'server-only'
import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { isSyntheticFathomEmail } from '@/lib/fathom/client'
import { isSyntheticBusinessEmail } from '@/lib/leads/serperMaps'
import {
  IMPORT_FIELDS,
  MAX_IMPORT_ROWS,
  cleanImportValue,
  parseLeadFieldSources,
  type ImportApp,
  type ImportColumnMapping,
  type ImportField,
  type LeadFieldSources,
  type MappedLeadRow,
} from './leadImportApps'

/**
 * Brings mapped rows into the lead list. A row joins an existing lead when its email, website or
 * phone matches one, so a Sellbird row can give a Google Maps business its real email. On a match
 * a field is only changed when it is empty, or when the /lead/intel board says that field comes
 * from this app; everything else the lead already has is kept.
 */

export type ImportLeadRowsResult = {
  batchId: string
  rowCount: number
  created: number
  updated: number
  skipped: number
  /** Rows past MAX_IMPORT_ROWS that were left out. */
  truncated: number
}

const IMPORT_EMAIL_DOMAIN = '@import.local'

export function isSyntheticImportEmail(email: string | null | undefined): boolean {
  return Boolean(email?.toLowerCase().endsWith(IMPORT_EMAIL_DOMAIN))
}

function isSyntheticEmail(email: string | null | undefined): boolean {
  return !email || isSyntheticImportEmail(email) || isSyntheticFathomEmail(email) || isSyntheticBusinessEmail(email)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** "https://www.Harbor-Dental.com/about" → "harbor-dental.com". */
export function websiteKey(value: string | null | undefined): string | null {
  if (!value) return null
  const host = value
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/^www\./, '')
    .split(/[/?#]/)[0]
  return host && host.includes('.') ? host : null
}

/** The last ten digits, so "+1 (602) 555-0141" and "6025550141" match. */
export function phoneKey(value: string | null | undefined): string | null {
  const digits = (value || '').replace(/\D/g, '')
  return digits.length >= 7 ? digits.slice(-10) : null
}

/** A stable stand-in address for a row with no email, so importing the same file twice matches. */
function syntheticImportEmail(row: MappedLeadRow): string {
  const basis = [row.name, row.company, row.phone, row.website].map((v) => (v || '').trim().toLowerCase()).join('|')
  return `import-${createHash('sha256').update(basis).digest('hex').slice(0, 20)}${IMPORT_EMAIL_DOMAIN}`
}

type ExistingLead = {
  id: string
  email: string
  name: string
  position: string | null
  phone: string | null
  website: string | null
  company: string | null
  address: string | null
  notes: string | null
  importApp: string | null
}

function isEmpty(field: ImportField, value: string | null | undefined): boolean {
  if (field === 'email') return isSyntheticEmail(value)
  return !value || !value.trim()
}

function shouldWrite(
  field: ImportField,
  existing: string | null | undefined,
  incoming: string | undefined,
  app: ImportApp,
  sources: LeadFieldSources,
): boolean {
  if (!incoming) return false
  if (isEmpty(field, existing)) return true
  if ((existing || '').trim() === incoming) return false
  return sources[field] === app
}

/** Cleans a row and gives it a name; null when there is nothing to call the lead. */
function prepareRow(raw: MappedLeadRow): MappedLeadRow | null {
  const row: MappedLeadRow = {}
  for (const field of IMPORT_FIELDS) {
    const value = cleanImportValue(field, raw[field])
    if (value) row[field] = value
  }
  if (row.email) {
    const email = row.email.toLowerCase()
    if (EMAIL_RE.test(email)) row.email = email
    else delete row.email
  }
  if (!row.name) {
    const fallback = row.company || row.email || websiteKey(row.website) || row.phone
    if (!fallback) return null
    row.name = fallback.slice(0, 255)
  }
  return row
}

export async function importLeadRows(options: {
  userId: string
  app: ImportApp
  /** File name, Drive link title or "Webhook push". */
  label: string
  rows: MappedLeadRow[]
  /** Saved for this app so the next import of the same export maps itself. */
  mapping?: ImportColumnMapping
  /** Columns and sample values of a webhook push, kept so the page can show them. */
  lastColumns?: Prisma.InputJsonValue
}): Promise<ImportLeadRowsResult> {
  const { userId, app } = options
  const truncated = Math.max(0, options.rows.length - MAX_IMPORT_ROWS)
  const incoming = options.rows.slice(0, MAX_IMPORT_ROWS)

  const [settings, existingLeads] = await Promise.all([
    prismaClient.callIntelSettings.findUnique({
      where: { userId },
      select: { leadFieldSources: true, defaultAgentId: true },
    }),
    prismaClient.callIntelLead.findMany({
      where: { userId },
      select: {
        id: true,
        email: true,
        name: true,
        position: true,
        phone: true,
        website: true,
        company: true,
        address: true,
        notes: true,
        importApp: true,
      },
      take: 20_000,
    }),
  ])
  const sources = parseLeadFieldSources(settings?.leadFieldSources)

  const source = await prismaClient.leadImportSource.upsert({
    where: { userId_app: { userId, app } },
    create: {
      userId,
      app,
      mapping: options.mapping ?? undefined,
      lastColumns: options.lastColumns ?? undefined,
      lastImportAt: new Date(),
    },
    update: {
      ...(options.mapping ? { mapping: options.mapping } : {}),
      ...(options.lastColumns ? { lastColumns: options.lastColumns } : {}),
      lastImportAt: new Date(),
    },
    select: { id: true },
  })

  const batch = await prismaClient.leadImportBatch.create({
    data: {
      userId,
      sourceId: source.id,
      app,
      label: options.label.slice(0, 255) || 'Import',
      rowCount: incoming.length,
    },
    select: { id: true },
  })

  // Lookups over the user's leads, kept current as rows are matched or added so duplicates
  // inside the same file merge into one lead.
  const byEmail = new Map<string, ExistingLead>()
  const byWebsite = new Map<string, ExistingLead>()
  const byPhone = new Map<string, ExistingLead>()
  const index = (lead: ExistingLead) => {
    byEmail.set(lead.email.toLowerCase(), lead)
    const site = websiteKey(lead.website)
    if (site && !byWebsite.has(site)) byWebsite.set(site, lead)
    const phone = phoneKey(lead.phone)
    if (phone && !byPhone.has(phone)) byPhone.set(phone, lead)
  }
  existingLeads.forEach(index)

  const creates = new Map<string, Prisma.CallIntelLeadCreateManyInput>()
  const updates = new Map<string, Prisma.CallIntelLeadUpdateInput>()
  let skipped = 0

  for (const raw of incoming) {
    const row = prepareRow(raw)
    if (!row) {
      skipped++
      continue
    }
    const fallbackEmail = row.email ? null : syntheticImportEmail(row)
    const match =
      (row.email && byEmail.get(row.email)) ||
      (row.website && byWebsite.get(websiteKey(row.website) || '')) ||
      (row.phone && byPhone.get(phoneKey(row.phone) || '')) ||
      (fallbackEmail && byEmail.get(fallbackEmail)) ||
      null

    if (!match) {
      const email = row.email || fallbackEmail!
      const lead: ExistingLead = {
        id: `new:${email}`,
        email,
        name: row.name!,
        position: row.position ?? null,
        phone: row.phone ?? null,
        website: row.website ?? null,
        company: row.company ?? null,
        address: row.address ?? null,
        notes: row.notes ?? null,
        importApp: app,
      }
      creates.set(email, {
        userId,
        email,
        name: lead.name,
        position: lead.position,
        phone: lead.phone,
        website: lead.website,
        company: lead.company,
        address: lead.address,
        notes: lead.notes,
        source: 'IMPORT',
        importApp: app,
        importBatchId: batch.id,
        selectedAgentId: settings?.defaultAgentId || null,
      })
      index(lead)
      continue
    }

    // A lead added earlier in this same import: fold the row into its create.
    if (match.id.startsWith('new:')) {
      const pending = creates.get(match.email)
      if (pending) {
        for (const field of IMPORT_FIELDS) {
          if (field === 'email' || pending[field] || !row[field]) continue
          ;(pending as Record<string, unknown>)[field] = row[field]
          ;(match as Record<string, unknown>)[field] = row[field]
        }
        index(match)
      }
      continue
    }

    const data: Prisma.CallIntelLeadUpdateInput = updates.get(match.id) ?? {
      importBatch: { connect: { id: batch.id } },
      ...(match.importApp ? {} : { importApp: app }),
    }
    let changed = false
    for (const field of IMPORT_FIELDS) {
      if (!shouldWrite(field, match[field], row[field], app, sources)) continue
      // Never take an address another lead already uses: email is unique per user.
      if (field === 'email' && byEmail.has(row.email!) && byEmail.get(row.email!) !== match) continue
      ;(data as Record<string, unknown>)[field] = row[field]
      if (field === 'email') {
        byEmail.delete(match.email.toLowerCase())
        match.email = row.email!
        byEmail.set(match.email, match)
      } else {
        ;(match as Record<string, unknown>)[field] = row[field]
      }
      changed = true
    }
    if (changed || !updates.has(match.id)) updates.set(match.id, data)
  }

  if (creates.size > 0) {
    await prismaClient.callIntelLead.createMany({ data: [...creates.values()], skipDuplicates: true })
  }
  const updateList = [...updates.entries()]
  for (let i = 0; i < updateList.length; i += 50) {
    await prismaClient.$transaction(
      updateList
        .slice(i, i + 50)
        .map(([id, data]) => prismaClient.callIntelLead.update({ where: { id }, data })),
    )
  }

  await prismaClient.leadImportBatch.update({
    where: { id: batch.id },
    data: { createdCount: creates.size, updatedCount: updates.size, skippedCount: skipped },
  })

  return {
    batchId: batch.id,
    rowCount: incoming.length,
    created: creates.size,
    updated: updates.size,
    skipped,
    truncated,
  }
}

/** Applies a saved mapping (lead field → column header) to header/row arrays. */
export function mapSheetRows(headers: string[], rows: string[][], mapping: ImportColumnMapping): MappedLeadRow[] {
  const columnOf = new Map<ImportField, number>()
  for (const field of IMPORT_FIELDS) {
    const header = mapping[field]
    if (!header) continue
    const index = headers.indexOf(header)
    if (index >= 0) columnOf.set(field, index)
  }
  return rows.map((cells) => {
    const row: MappedLeadRow = {}
    for (const [field, index] of columnOf) row[field] = cells[index]
    return row
  })
}
