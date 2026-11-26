'use server'

import { onAuthenticateUser } from '@/actions/auth'
import { getPartnerConnectorsForWorkspace } from '@/actions/inboundConnectors'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'
import { COMPOSE_KINDS, composeLeadEmail, composeThreadDraft, type ComposeKind } from '@/lib/messages/compose'
import { deleteDraft } from '@/lib/messages/drafts'
import { emailSourceFor } from '@/lib/email/sendEmail'
import {
  createAssistantChat,
  emailableLeads,
  saveAssistantTurn,
  listInbox,
  loadThread,
  sendInboxReply,
  sendLeadEmail,
  setThreadAiPaused,
  type InboxThread,
  type ThreadDetail,
} from '@/lib/messages/inbox'

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

async function currentUserId() {
  const auth = await onAuthenticateUser()
  return auth.user?.id ?? null
}

const message = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong. Try again.')

export async function loadThreadAction(input: { id: string }): Promise<Result<ThreadDetail>> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  const thread = await loadThread(userId, input.id)
  return thread ? { ok: true, data: thread } : { ok: false, error: 'That conversation is gone.' }
}

export async function sendReplyAction(input: { id: string; text: string; subject?: string }): Promise<Result<ThreadDetail>> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  try {
    await sendInboxReply(userId, input.id, { text: input.text, subject: input.subject })
  } catch (error) {
    return { ok: false, error: message(error) }
  }
  const thread = await loadThread(userId, input.id)
  return thread ? { ok: true, data: thread } : { ok: false, error: 'Sent, but the conversation could not be reloaded.' }
}

export async function setAiPausedAction(input: { id: string; paused: boolean }): Promise<Result<null>> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  try {
    await setThreadAiPaused(userId, input.id, input.paused)
  } catch (error) {
    return { ok: false, error: message(error) }
  }
  return { ok: true, data: null }
}

export async function searchEmailLeadsAction(input: { search: string }) {
  const userId = await currentUserId()
  if (!userId) return { ok: false as const, error: 'Sign in again.' }
  return { ok: true as const, data: await emailableLeads(userId, input.search.trim().slice(0, 100)) }
}

export async function sendLeadEmailAction(input: { leadId: string; subject: string; text: string }): Promise<Result<{ threadId: string }>> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  try {
    const sent = await sendLeadEmail(userId, { ...input, from: 'creator' })
    return { ok: true, data: { threadId: sent.threadId } }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

/** "Write with AI" in a conversation: the draft is saved there; nothing is sent. */
export async function composeDraftAction(input: { id: string; kind: string; note?: string }): Promise<Result<ThreadDetail>> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  if (!(COMPOSE_KINDS as readonly string[]).includes(input.kind)) return { ok: false, error: 'Pick what to write.' }
  try {
    const thread = await composeThreadDraft(userId, input.id, input.kind as ComposeKind, input.note?.trim().slice(0, 500))
    if (!thread) return { ok: false, error: 'That conversation is gone.' }
    return { ok: true, data: thread }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

/** "Write with AI" for a new email to a lead: opens their thread with the draft. */
export async function composeLeadEmailAction(input: { leadId: string; kind: string; note?: string }): Promise<Result<{ threadId: string }>> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  if (!(COMPOSE_KINDS as readonly string[]).includes(input.kind)) return { ok: false, error: 'Pick what to write.' }
  try {
    const draft = await composeLeadEmail(userId, input.leadId, input.kind as ComposeKind, input.note?.trim().slice(0, 500))
    return { ok: true, data: { threadId: draft.threadId } }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

export async function discardDraftAction(input: { id: string }): Promise<Result<null>> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  const thread = await loadThread(userId, input.id)
  if (thread?.conversationId) await deleteDraft(userId, thread.conversationId)
  return { ok: true, data: null }
}

/** Everything the Messages panel needs: the conversations and whether email can be sent. */
/** What the partner assistant conversation needs: the business room and the apps connected to it. */
export type PartnerAssistantInfo = { tenantId: string; connectedPartners: { id: string; kind: string; label: string }[] }

async function partnerAssistantFor(userId: string): Promise<PartnerAssistantInfo | null> {
  const business = await getCreatorBusiness(userId)
  if (!business?.workspaceId) return null
  const connectors = await getPartnerConnectorsForWorkspace(business.workspaceId, userId).catch(() => [])
  return {
    tenantId: business.workspaceId,
    connectedPartners: connectors
      .filter((connector) => connector.enabled)
      .map((connector) => ({ id: connector.id, kind: connector.kind, label: connector.label })),
  }
}

export async function listInboxAction(): Promise<
  Result<{ threads: InboxThread[]; canEmail: boolean; partnerAssistant: PartnerAssistantInfo | null }>
> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  const [threads, source, partnerAssistant] = await Promise.all([
    listInbox(userId),
    emailSourceFor(userId),
    partnerAssistantFor(userId),
  ])
  return { ok: true, data: { threads, canEmail: source === 'creator', partnerAssistant } }
}

/** Starts a new partner chat in Messages and returns its id. */
export async function createAssistantChatAction(): Promise<Result<{ threadId: string }>> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  try {
    return { ok: true, data: await createAssistantChat(userId) }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

/** Saves a partner chat turn (the ask and the assistant's answer) and returns the thread. */
export async function saveAssistantTurnAction(input: { id: string; ask?: string; reply: string }): Promise<Result<ThreadDetail>> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  try {
    await saveAssistantTurn(userId, input.id, { ask: input.ask, reply: input.reply })
  } catch (error) {
    return { ok: false, error: message(error) }
  }
  const thread = await loadThread(userId, input.id)
  return thread ? { ok: true, data: thread } : { ok: false, error: 'Saved, but the conversation could not be reloaded.' }
}
