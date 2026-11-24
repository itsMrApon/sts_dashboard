import 'server-only'
import { getCreatorDriveAccess, uploadToCreatorDrive } from '@/lib/google/drive'
import type { ChatDocumentRequest, DocumentAccept } from '@/lib/services/types'

/**
 * A visitor's file from the chat's attach button: checked here, then saved to the creator's
 * Google Drive. Only allowed when the creator's chat assistant asks for at least one document.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

const PDF_TYPES = ['application/pdf']
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

function allowedTypes(accept: DocumentAccept): string[] {
  if (accept === 'pdf') return PDF_TYPES
  if (accept === 'image') return IMAGE_TYPES
  return [...PDF_TYPES, ...IMAGE_TYPES]
}

export type ChatUploadResult =
  | { ok: true; file: { name: string; url: string | null }; message: string }
  | { ok: false; status: number; code: string; error: string }

function safeFileName(name: string): string {
  // Keep Bangla and other letters; drop path separators and control characters only.
  return name.replace(/[\\/\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'upload'
}

export async function saveChatUpload(input: {
  ownerUserId: string
  documentRequests: ChatDocumentRequest[]
  file: File | null
  documentId: string | null
}): Promise<ChatUploadResult> {
  if (input.documentRequests.length === 0) {
    return { ok: false, status: 403, code: 'UPLOADS_OFF', error: 'This chat does not take files.' }
  }
  const file = input.file
  if (!file || file.size === 0) return { ok: false, status: 400, code: 'NO_FILE', error: 'Choose a file to send.' }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, status: 413, code: 'FILE_TOO_LARGE', error: 'That file is over 10 MB. Send a smaller one.' }
  }

  const request = input.documentRequests.find((doc) => doc.id === input.documentId) ?? null
  const accepted = request
    ? allowedTypes(request.accept)
    : [...new Set(input.documentRequests.flatMap((doc) => allowedTypes(doc.accept)))]
  if (!accepted.includes(file.type)) {
    return { ok: false, status: 415, code: 'FILE_TYPE', error: 'Send a PDF or a photo (JPG, PNG, WebP or HEIC).' }
  }

  const access = await getCreatorDriveAccess(input.ownerUserId)
  if (!access.ok) {
    console.warn(`[chat-upload] creator Drive not ready: ${access.reason}`)
    return {
      ok: false,
      status: 503,
      code: 'DRIVE_NOT_READY',
      error: "We can't take files here right now. Please send it another way.",
    }
  }

  const day = new Date().toISOString().slice(0, 10)
  const label = request?.name ? `${request.name} - ` : ''
  try {
    const saved = await uploadToCreatorDrive(access.accessToken, {
      name: `${day} ${label}${safeFileName(file.name)}`,
      mimeType: file.type,
      bytes: await file.arrayBuffer(),
    })
    return {
      ok: true,
      file: { name: saved.name, url: saved.webViewLink },
      // Sent on as the visitor's next chat message so the assistant acknowledges the file.
      message: `[Uploaded: ${request?.name ?? 'document'} · ${safeFileName(file.name)}]`,
    }
  } catch (error) {
    console.error('[chat-upload]', error)
    return { ok: false, status: 502, code: 'UPLOAD_FAILED', error: "The file didn't go through. Please try again." }
  }
}
