/**
 * The apps /lead/intel brings leads in from, and the lead fields they can fill. Shared by the page,
 * the import route and the n8n webhook, so it must stay free of server-only imports.
 */

/** Apps that send leads through an import (a file, a link or a webhook push). */
export const IMPORT_APPS = ['SELLBIRD', 'N8N', 'CSV', 'GOOGLE_DRIVE'] as const
export type ImportApp = (typeof IMPORT_APPS)[number]

/** Every app on the board, including the two that bring leads in on their own. */
export const LEAD_APPS = ['SELLBIRD', 'GOOGLE_MAPS', 'N8N', 'FATHOM', 'CSV', 'GOOGLE_DRIVE'] as const
export type LeadApp = (typeof LEAD_APPS)[number]

export const LEAD_APP_LABEL: Record<LeadApp, string> = {
  SELLBIRD: 'Sellbird',
  GOOGLE_MAPS: 'Google Maps',
  N8N: 'n8n',
  FATHOM: 'Fathom',
  CSV: 'Your own CSV',
  GOOGLE_DRIVE: 'Google Drive',
}

/** What each app brings, shown under its name on the board. */
export const LEAD_APP_PROVIDES: Record<LeadApp, string> = {
  SELLBIRD: 'verified emails · decision makers',
  GOOGLE_MAPS: 'phone · website · address',
  N8N: 'anything your workflow sends',
  FATHOM: 'calls · summaries',
  CSV: 'any spreadsheet export',
  GOOGLE_DRIVE: 'a shared CSV or Sheet',
}

export function isImportApp(value: unknown): value is ImportApp {
  return typeof value === 'string' && (IMPORT_APPS as readonly string[]).includes(value)
}

export function isLeadApp(value: unknown): value is LeadApp {
  return typeof value === 'string' && (LEAD_APPS as readonly string[]).includes(value)
}

/** Lead fields an import can fill, in board order. */
export const IMPORT_FIELDS = ['name', 'position', 'email', 'phone', 'company', 'website', 'address', 'notes'] as const
export type ImportField = (typeof IMPORT_FIELDS)[number]

export const IMPORT_FIELD_LABEL: Record<ImportField, string> = {
  name: 'Name',
  position: 'Position',
  email: 'Email',
  phone: 'Phone',
  company: 'Company',
  website: 'Website',
  address: 'Address',
  notes: 'Notes',
}

/** Header spellings that mean each field. Used by the column matcher and the webhook. */
export const IMPORT_FIELD_SYNONYMS: Record<ImportField, string[]> = {
  name: ['full name', 'contact name', 'contact', 'person', 'lead name', 'business name', 'first name'],
  position: ['title', 'job title', 'role', 'designation', 'job', 'position', 'job position'],
  email: ['e-mail', 'mail', 'email address', 'contact email', 'work email'],
  phone: ['mobile', 'tel', 'telephone', 'phone number', 'cell', 'whatsapp'],
  company: ['business', 'organization', 'organisation', 'org', 'company name', 'account'],
  website: ['site', 'url', 'domain', 'homepage', 'web'],
  address: ['location', 'street', 'city', 'full address'],
  notes: ['note', 'description', 'comment', 'comments', 'summary', 'about'],
}

/** Which app each field comes from, as saved from the board. */
export type LeadFieldSources = Partial<Record<ImportField, LeadApp>>

export function parseLeadFieldSources(value: unknown): LeadFieldSources {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: LeadFieldSources = {}
  for (const field of IMPORT_FIELDS) {
    const app = (value as Record<string, unknown>)[field]
    if (isLeadApp(app)) out[field] = app
  }
  return out
}

/** One row after mapping: lead field → value. */
export type MappedLeadRow = Partial<Record<ImportField, string>>

/** Saved column mapping for an app: lead field → column header. */
export type ImportColumnMapping = Partial<Record<ImportField, string>>

export function parseImportColumnMapping(value: unknown): ImportColumnMapping {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: ImportColumnMapping = {}
  for (const field of IMPORT_FIELDS) {
    const column = (value as Record<string, unknown>)[field]
    if (typeof column === 'string' && column.trim()) out[field] = column
  }
  return out
}

/** Most rows one import takes. Bigger files are cut here and the page says so. */
export const MAX_IMPORT_ROWS = 5000

const FIELD_MAX_LENGTH: Record<ImportField, number> = {
  name: 255,
  position: 150,
  email: 255,
  phone: 50,
  company: 255,
  website: 500,
  address: 500,
  notes: 4000,
}

/** Trim and cut a value to fit its column. Never changes the characters (Bangla stays as typed). */
export function cleanImportValue(field: ImportField, raw: unknown): string {
  if (raw == null) return ''
  const text = String(raw).trim()
  return text.length > FIELD_MAX_LENGTH[field] ? text.slice(0, FIELD_MAX_LENGTH[field]) : text
}
