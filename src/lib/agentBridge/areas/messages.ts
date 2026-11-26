import 'server-only'
import { prismaClient } from '@/lib/prismaClient'
import { isDeliverableEmail } from '@/lib/email/sendEmail'
import { listInbox, loadThread } from '@/lib/messages/inbox'
import { draftLeadEmail, ensureConversation, saveDraft } from '@/lib/messages/drafts'
import { AgentInputError, int, str, type AgentTool } from '../types'

/**
 * Messages for the agent: it reads conversations and writes drafts. A draft lands in the
 * conversation at once and only goes out when the creator clicks Send. Lead matches (this lead
 * needs what you sell) wait in Lead → Approval first; allowing one puts its email draft here.
 */
export const MESSAGE_TOOLS: AgentTool[] = [
  {
    kind: 'read',
    name: 'list_conversations',
    area: 'messages',
    title: 'Conversations',
    description:
      'The business’s conversations from WhatsApp, the website chat, offer chats, email and Instagram comment-to-DM, newest first, with the lead each belongs to and whether the customer is waiting for an answer.',
    inputSchema: {
      type: 'object',
      properties: {
        waiting_only: { type: 'boolean', description: 'Only conversations where the customer wrote last.' },
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Default 30.' },
      },
      additionalProperties: false,
    },
    async run(ctx, input) {
      // Partner chats are the creator talking to their apps, not customers.
      const all = (await listInbox(ctx.userId)).filter((t) => t.source !== 'assistant')
      const threads = (input.waiting_only === true ? all.filter((t) => t.needsReply) : all).slice(0, int(input, 'limit', { min: 1, max: 100, fallback: 30 }))
      if (threads.length === 0) return 'No conversations.'
      return { text: JSON.stringify(threads, null, 2), structured: { threads } }
    },
  },
  {
    kind: 'read',
    name: 'read_conversation',
    area: 'messages',
    title: 'Read a conversation',
    description: 'All messages of one conversation (from list_conversations), and whether a reply is possible on its channel right now.',
    inputSchema: {
      type: 'object',
      properties: { conversation_id: { type: 'string' } },
      required: ['conversation_id'],
      additionalProperties: false,
    },
    async run(ctx, input) {
      const thread = await loadThread(ctx.userId, str(input, 'conversation_id', { max: 80, required: true }))
      if (!thread) throw new AgentInputError('No conversation with that id. Call list_conversations.')
      return { text: JSON.stringify(thread, null, 2), structured: thread as unknown as Record<string, unknown> }
    },
  },
  {
    kind: 'write',
    policy: 'direct',
    name: 'draft_reply',
    area: 'messages',
    title: 'Reply in a conversation',
    description:
      'Write a reply draft in one conversation, on the channel the customer used. Write as the business, in the customer’s language. It waits in Messages; the creator reviews it and clicks Send.',
    inputSchema: {
      type: 'object',
      properties: {
        conversation_id: { type: 'string' },
        text: { type: 'string', description: 'The reply, up to 4000 characters.' },
      },
      required: ['conversation_id', 'text'],
      additionalProperties: false,
    },
    async propose(ctx, input) {
      const id = str(input, 'conversation_id', { max: 80, required: true })
      const text = str(input, 'text', { max: 4000, required: true })
      const thread = await loadThread(ctx.userId, id)
      if (!thread || thread.source === 'assistant') throw new AgentInputError('No conversation with that id. Call list_conversations.')
      const lastTheirs = [...thread.messages].reverse().find((m) => m.who === 'them')
      return {
        title: 'Reply to',
        detail: thread.title,
        display: { to: `${thread.title} (${thread.source})`, theyWrote: lastTheirs?.text ?? '', reply: text },
        payload: { id, text },
      }
    },
    async apply(ctx, payload) {
      const id = String(payload.id)
      const thread = await loadThread(ctx.userId, id)
      if (!thread) throw new Error('That conversation is gone.')
      const conversationId = thread.conversationId ?? (await ensureConversation(ctx.userId, `instagram:${id.slice(3)}`))
      await saveDraft({ userId: ctx.userId, conversationId, kind: 'reply', source: 'agent', body: String(payload.text) })
      return { draft: 'saved in Messages; the creator sends it', canSendNow: thread.canReply }
    },
  },
  {
    kind: 'write',
    policy: 'direct',
    name: 'draft_email_to_lead',
    area: 'messages',
    title: 'Email a lead',
    description:
      'Draft an email to one lead (id from list_leads) from the creator’s own mailbox: a first touch or a follow-up, grounded in the business brain and what you know about the lead. Plain text, short, one clear ask. It waits in Messages; the creator clicks Send.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string' },
        subject: { type: 'string', description: 'Up to 200 characters.' },
        body: { type: 'string', description: 'Plain text, up to 10000 characters.' },
      },
      required: ['lead_id', 'subject', 'body'],
      additionalProperties: false,
    },
    async propose(ctx, input) {
      const leadId = str(input, 'lead_id', { max: 64, required: true })
      const subject = str(input, 'subject', { max: 200, required: true })
      const body = str(input, 'body', { max: 10_000, required: true })
      const lead = await prismaClient.callIntelLead.findFirst({
        where: { id: leadId, userId: ctx.userId },
        select: { name: true, company: true, email: true },
      })
      if (!lead) throw new AgentInputError('No lead with that id. Call list_leads.')
      if (!isDeliverableEmail(lead.email)) throw new AgentInputError('That lead has no real email address.')
      return {
        title: 'Email',
        detail: lead.company || lead.name,
        display: { to: `${lead.company || lead.name} <${lead.email}>`, subject, message: body },
        payload: { leadId, subject, body },
      }
    },
    async apply(ctx, payload) {
      const draft = await draftLeadEmail({
        userId: ctx.userId,
        leadId: String(payload.leadId),
        kind: 'email',
        source: 'agent',
        subject: String(payload.subject),
        body: String(payload.body),
      })
      return { draft: 'saved in Messages; the creator sends it', to: draft.to }
    },
  },
  {
    kind: 'write',
    name: 'propose_lead_match',
    area: 'leads',
    title: 'Lead match',
    description:
      'You found a lead (id from list_leads) who needs something the business sells (from get_business_brain / list_offers). Propose the match with why it fits and a first email. The creator approves it in Lead → Approval; then the email waits as a draft in Messages for them to send.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string' },
        offer: { type: 'string', description: 'The offer or service that fits, by its name.' },
        reason_it_fits: { type: 'string', description: 'One or two sentences: the evidence this lead needs it.' },
        subject: { type: 'string' },
        body: { type: 'string', description: 'Plain-text first email, short, one clear ask.' },
      },
      required: ['lead_id', 'offer', 'reason_it_fits', 'subject', 'body'],
      additionalProperties: false,
    },
    async propose(ctx, input) {
      return proposeLeadMatch(ctx.userId, {
        leadId: str(input, 'lead_id', { max: 64, required: true }),
        offer: str(input, 'offer', { max: 200, required: true }),
        why: str(input, 'reason_it_fits', { max: 500, required: true }),
        subject: str(input, 'subject', { max: 200, required: true }),
        body: str(input, 'body', { max: 10_000, required: true }),
      })
    },
    async apply(ctx, payload) {
      const draft = await draftLeadEmail({
        userId: ctx.userId,
        leadId: String(payload.leadId),
        kind: 'match',
        source: 'match',
        subject: String(payload.subject),
        body: String(payload.body),
        note: `${String(payload.offer)}: ${String(payload.why)}`,
      })
      return { draft: 'email waiting in Messages', threadId: draft.threadId, to: draft.to }
    },
  },
]

/** Checks a lead match and describes it for the Approval card. Shared by the agent and Find matches. */
export async function proposeLeadMatch(
  userId: string,
  input: { leadId: string; offer: string; why: string; subject: string; body: string },
) {
  const lead = await prismaClient.callIntelLead.findFirst({
    where: { id: input.leadId, userId },
    select: { name: true, company: true, email: true },
  })
  if (!lead) throw new AgentInputError('No lead with that id. Call list_leads.')
  if (!isDeliverableEmail(lead.email)) throw new AgentInputError('That lead has no real email address to write to.')
  const who = lead.company || lead.name
  return {
    title: 'Lead match',
    detail: `${who} · ${input.offer}`,
    display: { to: `${who} <${lead.email}>`, offer: input.offer, whyItFits: input.why, subject: input.subject, message: input.body },
    payload: { leadId: input.leadId, offer: input.offer, why: input.why, subject: input.subject, body: input.body },
  }
}
