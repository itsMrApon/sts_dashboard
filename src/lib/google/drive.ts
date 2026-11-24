import { prismaClient } from '@/lib/prismaClient'
import { decryptToken } from '@/lib/messages/encrypt'
import {
  hasDriveFileScope,
  refreshGoogleAccessToken,
  resolveGoogleOAuthCredentials,
} from '@/lib/leads/googleCalendar'

/**
 * Saves files to a creator's Google Drive through their Google connection (Integrations →
 * Google). The connection holds only the drive.file permission, so sts-ai can see the files it
 * creates and nothing else in their Drive.
 */

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const UPLOAD_FOLDER_NAME = 'sts-ai uploads'
const DRIVE_TIMEOUT_MS = 25_000

export type DriveAccess =
  | { ok: true; accessToken: string }
  | { ok: false; reason: 'not_connected' | 'needs_drive_permission' | 'token_failed' }

/** A short-lived access token for the creator's Drive, or why there is none. */
export async function getCreatorDriveAccess(userId: string): Promise<DriveAccess> {
  const connection = await prismaClient.callIntelConnection.findFirst({
    where: { userId, provider: 'GOOGLE_CALENDAR', status: 'ACTIVE' },
    select: { credentials: true, metadata: true },
  })
  if (!connection) return { ok: false, reason: 'not_connected' }
  if (!hasDriveFileScope(connection.metadata)) return { ok: false, reason: 'needs_drive_permission' }

  const refreshToken = decryptToken((connection.credentials as { refreshToken?: string } | null)?.refreshToken)
  const oauth = await resolveGoogleOAuthCredentials(userId)
  if (!refreshToken || !oauth) return { ok: false, reason: 'not_connected' }
  try {
    const tokens = await refreshGoogleAccessToken({
      refreshToken,
      clientId: oauth.clientId,
      clientSecret: oauth.clientSecret,
    })
    return { ok: true, accessToken: tokens.access_token }
  } catch {
    return { ok: false, reason: 'token_failed' }
  }
}

async function driveFetch(url: string, accessToken: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(DRIVE_TIMEOUT_MS),
  })
}

/** The "sts-ai uploads" folder this app created in the creator's Drive, made on first use. */
async function ensureUploadFolder(accessToken: string): Promise<string> {
  const query = `name = '${UPLOAD_FOLDER_NAME}' and mimeType = '${FOLDER_MIME}' and trashed = false`
  const search = await driveFetch(`${DRIVE_API}?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1`, accessToken)
  if (!search.ok) throw new Error(`Drive search failed (${search.status})`)
  const found = (await search.json()) as { files?: { id: string }[] }
  if (found.files?.[0]?.id) return found.files[0].id

  const created = await driveFetch(`${DRIVE_API}?fields=id`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: UPLOAD_FOLDER_NAME, mimeType: FOLDER_MIME }),
  })
  if (!created.ok) throw new Error(`Drive folder create failed (${created.status})`)
  return ((await created.json()) as { id: string }).id
}

export type DriveFile = { id: string; name: string; webViewLink: string | null }

/** Uploads one file into the creator's "sts-ai uploads" folder. */
export async function uploadToCreatorDrive(
  accessToken: string,
  file: { name: string; mimeType: string; bytes: ArrayBuffer },
): Promise<DriveFile> {
  const folderId = await ensureUploadFolder(accessToken)
  const boundary = `sts-${crypto.randomUUID()}`
  const metadata = JSON.stringify({ name: file.name, parents: [folderId] })
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: ${file.mimeType}\r\n\r\n`,
    file.bytes,
    `\r\n--${boundary}--`,
  ])
  const res = await driveFetch(`${DRIVE_UPLOAD}?uploadType=multipart&fields=id,name,webViewLink`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  if (!res.ok) throw new Error(`Drive upload failed (${res.status})`)
  const saved = (await res.json()) as { id: string; name: string; webViewLink?: string }
  return { id: saved.id, name: saved.name, webViewLink: saved.webViewLink ?? null }
}
