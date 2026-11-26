import 'server-only'
import { prismaClient } from '@/lib/prismaClient'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'
import { isDeliverableEmail } from '@/lib/email/sendEmail'
import { appendToConversation } from './conversationStore'

/**
 * Drafts in Messages. Whoever writes one (the creator, "Write with AI", an AI agent, an
 * allowed lead match), it waits in the conversation until the creator clicks Send.
 */

export const DRAFT_KINDS = ['reply', 'message', 'email', 'greeting', 'offer', 'deadline', 'match'] as const
export type DraftKind = (typeof DRAFT_KINDS)[number]
export type DraftSource = 'you' | 'ai' | 'agent' | 'match'

export type DraftView = {
  kind: string
  source: string
  subject: string | null
  body: string
  note: string | null
  updatedAt: string
}

export function toDraftView(draft: { kind: string; source: string; subject: string | null; body: string; note: string | null; updatedAt: Date }): DraftView {
  return { ...draft, updatedAt: draft.updatedAt.toISOString() }
}

export async function saveDraft(input: {
  userId: string
  conversationId: string
  kind: DraftKind
  source: DraftSource
  subject?: string | null
  body: string
  note?: string | null
}) {
  const data = {
    kind: input.kind,
    source: input.source,
    subject: input.subject?.trim().slice(0, 200) || null,
    body: input.body.trim().slice(0, 10_000),
    note: input.note?.trim().slice(0, 500) || null,
  }
  return prismaClient.messageDraft.upsert({
    where: { conversationId: input.conversationId },
    create: { userId: input.userId, conversationId: input.conversationId, ...data },
    update: data,
    select: { id: true, conversationId: true },
  })
}

export async function deleteDraft(userId: string, conversationId: string) {
  await prismaClient.messageDraft.deleteMany({ where: { userId, conversationId } })
}

/** The conversation for `externalId` on the business room, created empty if needed. */
export async function ensureConversation(userId: string, externalId: string): Promise<string> {
  const business = await getCreatorBusiness(userId)
  if (!business) throw new Error('Set up your business first.')
  const conversation = await appendToConversation({ roomName: business.roomName, userId, externalId, messages: [] })
  return conversation.id
}

/** A draft email to a lead (Lead → List), in its email thread. Returns the thread id. */
export async function draftLeadEmail(input: {
  userId: string
  leadId: string
  kind: DraftKind
  source: DraftSource
  subject: string
  body: string
  note?: string | null
}): Promise<{ threadId: string; to: string }> {
  const lead = await prismaClient.callIntelLead.findFirst({ where: { id: input.leadId, userId: input.userId }, select: { email: true } })
  if (!lead || !isDeliverableEmail(lead.email)) throw new Error('That lead has no email address.')
  const conversationId = await ensureConversation(input.userId, `email:${lead.email.toLowerCase()}`)
  await saveDraft({ ...input, conversationId })
  return { threadId: conversationId, to: lead.email }
}
