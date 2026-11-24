import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import {
  IMPORT_FIELDS,
  IMPORT_FIELD_LABEL,
  IMPORT_FIELD_SYNONYMS,
  type ImportColumnMapping,
  type ImportField,
} from './leadImportApps'

/** Webhook tokens are random; only their hash is looked up, the encrypted copy is for showing the URL. */
export function newWebhookToken(): string {
  return randomBytes(24).toString('base64url')
}

export function hashWebhookToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

const MAX_DEPTH = 3

/** `{ lead: { email: "a@b.co" } }` → `{ "lead.email": "a@b.co" }`. Arrays inside a lead are joined. */
function flatten(value: unknown, prefix: string, out: Record<string, string>, depth: number) {
  if (value == null) return
  if (Array.isArray(value)) {
    const scalars = value.filter((v) => v != null && typeof v !== 'object')
    if (scalars.length) out[prefix] = scalars.map(String).join(', ')
    return
  }
  if (typeof value === 'object') {
    if (depth >= MAX_DEPTH) return
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out, depth + 1)
    }
    return
  }
  if (prefix) out[prefix] = String(value)
}

/**
 * What n8n, Zapier or Make can send: one lead object, an array of them, or an object holding the
 * array under leads / items / data / rows. n8n's "body" wrapper is unwrapped too.
 */
export function recordsFromPayload(body: unknown): Record<string, string>[] {
  let list: unknown[] = []
  if (Array.isArray(body)) list = body
  else if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>
    const nested = ['leads', 'items', 'data', 'rows', 'records'].map((k) => obj[k]).find(Array.isArray)
    list = nested ? (nested as unknown[]) : [obj]
  }
  return list
    .map((item) => {
      const unwrapped =
        item && typeof item === 'object' && 'json' in (item as object) ? (item as { json: unknown }).json : item
      const out: Record<string, string> = {}
      flatten(unwrapped, '', out, 0)
      return out
    })
    .filter((record) => Object.keys(record).length > 0)
}

const normalize = (key: string) =>
  key
    .split('.')
    .pop()!
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Best guess at which key holds each field, by exact name or a known synonym. */
export function guessColumnMapping(headers: string[]): ImportColumnMapping {
  const mapping: ImportColumnMapping = {}
  const taken = new Set<string>()
  for (const field of IMPORT_FIELDS) {
    const names = new Set(
      [field, IMPORT_FIELD_LABEL[field as ImportField], ...IMPORT_FIELD_SYNONYMS[field as ImportField]].map(normalize),
    )
    const header = headers.find((h) => !taken.has(h) && names.has(normalize(h)))
    if (header) {
      mapping[field] = header
      taken.add(header)
    }
  }
  return mapping
}

/** Up to three values per key, for showing a push's columns on the page. */
export function sampleColumns(records: Record<string, string>[]): Array<{ name: string; samples: string[] }> {
  const names: string[] = []
  for (const record of records.slice(0, 50)) {
    for (const key of Object.keys(record)) if (!names.includes(key)) names.push(key)
  }
  return names.slice(0, 60).map((name) => ({
    name,
    samples: records
      .map((r) => r[name])
      .filter(Boolean)
      .slice(0, 3)
      .map((v) => v.slice(0, 120)),
  }))
}
