'use server'

import { onAuthenticateUser } from '@/actions/auth'
import { appendCreatorReply, loadPipelineThread } from '@/lib/offers/offerPipeline'
import type { PipelineMessage, PipelineThread } from '@/lib/offers/offerPipelineTypes'

/** Creator-side pipeline actions: read a buyer's conversation, and reply into their chat. */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const UUID_RE = /^[0-9a-f-]{36}$/i

export async function getPipelineThread(input: {
  webinarId: string
  contactId: string
}): Promise<Result<{ thread: PipelineThread }>> {
  if (!UUID_RE.test(input.webinarId) || !UUID_RE.test(input.contactId)) return { ok: false, error: 'Not found' }
  const auth = await onAuthenticateUser()
  if (!auth.user) return { ok: false, error: 'Please sign in again' }
  const thread = await loadPipelineThread(input.webinarId, auth.user.id, input.contactId)
  return thread ? { ok: true, thread } : { ok: false, error: 'Not found' }
}

export async function sendPipelineReply(input: {
  webinarId: string
  contactId: string
  text: string
}): Promise<Result<{ message: PipelineMessage }>> {
  if (!UUID_RE.test(input.webinarId) || !UUID_RE.test(input.contactId)) return { ok: false, error: 'Not found' }
  const auth = await onAuthenticateUser()
  if (!auth.user) return { ok: false, error: 'Please sign in again' }
  const result = await appendCreatorReply(input.webinarId, auth.user.id, input.contactId, input.text ?? '')
  return result.ok ? { ok: true, message: result.message } : result
}
