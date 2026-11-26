'use server'

import { revalidatePath } from 'next/cache'
import { onAuthenticateUser } from '@/actions/auth'
import { prismaClient } from '@/lib/prismaClient'
import { decryptToken, encryptToken } from '@/lib/messages/encrypt'
import { sheetFromCsv } from '@/lib/leads/import/parseCsv'
import { hashWebhookToken, newWebhookToken } from '@/lib/leads/import/webhookImport'
import { appBaseUrl } from '@/lib/leads/import/leadIntelData'
import { findN8nConnector, listN8nScripts, runN8nScript, type N8nScript } from '@/lib/leads/import/n8nScripts'
import { sampleColumns } from '@/lib/leads/import/webhookImport'

type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

async function requireUser() {
  const auth = await onAuthenticateUser()
  return auth.user ?? null
}

/** The n8n webhook URL, made on first use. `fresh` replaces it, so the old URL stops working. */
export async function getN8nWebhookUrl(fresh = false): Promise<ActionResult<{ url: string }>> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'Sign in again.' }

  const existing = await prismaClient.leadImportSource.findUnique({
    where: { userId_app: { userId: user.id, app: 'N8N' } },
    select: { webhookTokenEnc: true },
  })
  const current = fresh ? null : decryptToken(existing?.webhookTokenEnc)
  if (current) return { ok: true, data: { url: `${appBaseUrl()}/api/leads/import/${current}` } }

  const token = newWebhookToken()
  await prismaClient.leadImportSource.upsert({
    where: { userId_app: { userId: user.id, app: 'N8N' } },
    create: {
      userId: user.id,
      app: 'N8N',
      webhookTokenEnc: encryptToken(token),
      webhookTokenHash: hashWebhookToken(token),
    },
    update: { webhookTokenEnc: encryptToken(token), webhookTokenHash: hashWebhookToken(token) },
  })
  revalidatePath('/lead')
  return { ok: true, data: { url: `${appBaseUrl()}/api/leads/import/${token}` } }
}

const DRIVE_TIMEOUT_MS = 15_000
const DRIVE_MAX_BYTES = 8_000_000

/** Google Sheets or Drive share link → the CSV export URL. Only Google hosts are ever fetched. */
function driveExportUrl(link: string): string | null {
  let url: URL
  try {
    url = new URL(link.trim())
  } catch {
    return null
  }
  const sheet = url.hostname === 'docs.google.com' && url.pathname.match(/\/spreadsheets\/d\/([\w-]+)/)
  if (sheet) {
    const gid = url.searchParams.get('gid') || url.hash.match(/gid=(\d+)/)?.[1]
    return `https://docs.google.com/spreadsheets/d/${sheet[1]}/export?format=csv${gid ? `&gid=${gid}` : ''}`
  }
  if (url.hostname === 'drive.google.com') {
    const id = url.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] || url.searchParams.get('id')
    if (id && /^[\w-]+$/.test(id)) return `https://drive.google.com/uc?export=download&id=${id}`
  }
  return null
}

/** Reads a CSV or Google Sheet shared as "Anyone with the link" and returns its columns and rows. */
export async function readGoogleDriveLink(
  link: string,
): Promise<ActionResult<{ fileName: string; headers: string[]; rows: string[][] }>> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'Sign in again.' }
  const exportUrl = driveExportUrl(link)
  if (!exportUrl) return { ok: false, error: 'Paste a Google Sheets or Google Drive file link.' }

  try {
    const res = await fetch(exportUrl, { redirect: 'follow', signal: AbortSignal.timeout(DRIVE_TIMEOUT_MS) })
    const type = res.headers.get('content-type') || ''
    if (!res.ok || type.includes('text/html')) {
      return {
        ok: false,
        error: 'Google wouldn’t share that file. Set it to “Anyone with the link can view”, then try again.',
      }
    }
    const length = Number(res.headers.get('content-length') || 0)
    if (length > DRIVE_MAX_BYTES) return { ok: false, error: 'That file is over 8 MB. Split it and import the parts.' }
    const text = await res.text()
    if (text.length > DRIVE_MAX_BYTES) return { ok: false, error: 'That file is over 8 MB. Split it and import the parts.' }
    const sheet = sheetFromCsv(text)
    if (sheet.headers.length === 0 || sheet.rows.length === 0) {
      return { ok: false, error: 'That file has no rows. Use a CSV or a Google Sheet with a header row.' }
    }
    const name = res.headers.get('content-disposition')?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i)?.[1]
    return {
      ok: true,
      data: {
        fileName: name ? decodeURIComponent(name) : 'Google Drive file',
        headers: sheet.headers,
        rows: sheet.rows,
      },
    }
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError'
    return { ok: false, error: timedOut ? 'Google took too long to answer. Try again.' : 'Couldn’t read that link.' }
  }
}

const N8N_NOT_CONNECTED = 'Connect n8n in Integrations first.'

/** The n8n folder: the workflows (or MCP tools) the creator can run to fetch leads. */
export async function getN8nScripts(): Promise<ActionResult<{ scripts: N8nScript[] }>> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'Sign in again.' }
  const connector = await findN8nConnector(user.id)
  if (!connector) return { ok: false, error: N8N_NOT_CONNECTED }
  try {
    return { ok: true, data: { scripts: await listN8nScripts(connector) } }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Couldn’t read your n8n workflows.' }
  }
}

/** Runs one n8n script and returns what it found as a sheet (headers and rows) for the column matcher. */
export async function runN8nScriptForLeads(
  scriptId: string,
  inputs: Record<string, string> = {},
): Promise<ActionResult<{ headers: string[]; rows: string[][] }>> {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'Sign in again.' }
  if (typeof scriptId !== 'string' || !/^(wf|tool):.{1,200}$/.test(scriptId)) return { ok: false, error: 'Pick a script first.' }
  const connector = await findN8nConnector(user.id)
  if (!connector) return { ok: false, error: N8N_NOT_CONNECTED }
  const cleanInputs: Record<string, string> = {}
  for (const [key, value] of Object.entries(inputs ?? {}).slice(0, 5)) {
    if (typeof value === 'string') cleanInputs[key.slice(0, 64)] = value.slice(0, 500)
  }
  try {
    const records = await runN8nScript(connector, scriptId, cleanInputs)
    if (records.length === 0) {
      return { ok: false, error: 'The script ran but sent back no leads. Make its last node return the leads as items.' }
    }
    const headers = sampleColumns(records).map((c) => c.name)
    return { ok: true, data: { headers, rows: records.map((r) => headers.map((h) => r[h] ?? '')) } }
  } catch (err) {
    const timedOut = err instanceof Error && /timeout|aborted/i.test(err.message)
    return {
      ok: false,
      error: timedOut
        ? 'n8n took too long. Long workflows can send leads to the webhook instead.'
        : err instanceof Error
          ? err.message
          : 'The script failed.',
    }
  }
}
