import 'server-only'
import { Platform } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'
import { emailSourceFor, isDeliverableEmail, sendPlainEmail } from '@/lib/email/sendEmail'
import { instagramTokenFor } from '@/lib/instagram/connection'
import { sendDirectMessage } from '@/lib/instagram/graph'
import { decryptedApiKey } from '@/lib/whatsapp/connection'
import { sendText } from '@/lib/whatsapp/kapso'
import { appendToConversation, appendToConversationById, readStoredMessages, type StoredMessage } from './conversationStore'
import { deleteDraft, toDraftView, type DraftView } from './drafts'

/**
 * Messages: one inbox for every conversation the business has, whatever the channel,
 * each linked to its lead (Lead → List) when the phone, email or Instagram campaign matches.
 * Replies follow each channel's rules: WhatsApp and Instagram only within 24 hours of the
 * customer's last message, email from the creator's own mailbox.
 *
 * Storage: MessageConversation on the business room's WEB channel, keyed `whatsapp:<phone>`,
 * `instagram:<sender id>`, `email:<address>`, `offer:<slug>:<contact>`, a website session, or
 * `assistant:<id>` for a partner chat (the creator asking their connected apps, no customer).
 */

export type InboxSource = 'whatsapp' | 'website' | 'offer' | 'email' | 'instagram' | 'assistant'

export type InboxLead = { id: string; name: string; status: string }

export type InboxThread = {
  id: string
  source: InboxSource
  title: string
  preview: string
  lastAt: string | null
  /** The stored conversation (null for an Instagram thread with only comments). */
  conversationId: string | null
  /** A draft (by you, the AI, an agent or a lead match) is waiting to be sent. */
  hasDraft: boolean
  /** The last message is theirs: they are waiting for an answer. */
  needsReply: boolean
  aiPaused: boolean
  lead: InboxLead | null
  /** Where the conversation happened, e.g. the project an offer chat belongs to. */
  context: string | null
}

export type InboxMessage = {
  id: string
  /** `call`: a voice call with the AI (offer chats), shown as a card. */
  who: 'them' | 'ai' | 'you' | 'agent' | 'call'
  text: string
  subject?: string
  at: string | null
  call?: { durationSec: number | null; outcome: string | null; lines: { role: 'user' | 'agent'; text: string }[] }
}

export type ThreadDetail = InboxThread & {
  draft: DraftView | null
  messages: InboxMessage[]
  canReply: boolean
  /** Why replying is not possible, or what to know before replying. */
  replyNote: string | null
  /** Emails: the subject a reply gets. */
  replySubject?: string
}

const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000
const THREAD_LIMIT = 150
const REPLY_MAX = 4000

const digits = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '')
const phoneKey = (value: string | null | undefined) => digits(value).slice(-10)
const isUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value)

function sourceOf(externalId: string): InboxSource {
  if (externalId.startsWith('whatsapp:')) return 'whatsapp'
  if (externalId.startsWith('instagram:')) return 'instagram'
  if (externalId.startsWith('email:')) return 'email'
  if (externalId.startsWith('offer:')) return 'offer'
  if (externalId.startsWith('assistant:')) return 'assistant'
  return 'website'
}

/* ------------------------------------------------------------------ leads */

type LeadIndex = { byPhone: Map<string, InboxLead>; byEmail: Map<string, InboxLead>; byId: Map<string, InboxLead> }

const leadView = (lead: { id: string; name: string; company: string | null; outboundStatus: string }): InboxLead => ({
  id: lead.id,
  name: lead.company || lead.name,
  status: lead.outboundStatus,
})

async function leadIndex(userId: string): Promise<LeadIndex> {
  const leads = await prismaClient.callIntelLead.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: 5000,
    select: { id: true, name: true, company: true, outboundStatus: true, phone: true, email: true },
  })
  const byPhone = new Map<string, InboxLead>()
  const byEmail = new Map<string, InboxLead>()
  const byId = new Map<string, InboxLead>()
  for (const lead of leads) {
    const view = leadView(lead)
    byId.set(lead.id, view)
    const p = phoneKey(lead.phone)
    if (p.length >= 7 && !byPhone.has(p)) byPhone.set(p, view)
    if (isDeliverableEmail(lead.email) && !byEmail.has(lead.email.toLowerCase())) byEmail.set(lead.email.toLowerCase(), view)
  }
  return { byPhone, byEmail, byId }
}

/* ---------------------------------------------------------- conversations */

async function ownedConversations(userId: string, filter: { id?: string; externalIds?: string[] } = {}) {
  const business = await getCreatorBusiness(userId)
  return prismaClient.messageConversation.findMany({
    where: {
      ...(filter.id ? { id: filter.id } : {}),
      ...(filter.externalIds ? { externalId: { in: filter.externalIds } } : {}),
      platform: Platform.WEB,
      channel: { OR: [{ userId }, ...(business ? [{ roomName: business.roomName }] : [])] },
    },
    orderBy: { updatedAt: 'desc' },
    take: filter.id ? 1 : THREAD_LIMIT,
    select: { id: true, externalId: true, messages: true, aiPausedAt: true, updatedAt: true },
  })
}

type Conversation = Awaited<ReturnType<typeof ownedConversations>>[number]

/** `mine`: a partner chat, where the creator wrote the user turns and the assistant answered. */
function toInboxMessages(stored: StoredMessage[], prefix = '', mine = false): InboxMessage[] {
  return stored.map((m, i) => ({
    id: `${prefix}${i}`,
    who: m.role === 'user' ? (mine ? 'you' : 'them') : m.from === 'creator' ? 'you' : m.from === 'agent' ? 'agent' : 'ai',
    text: m.content,
    subject: m.subject,
    at: m.timestamp ?? null,
  }))
}

function summarize(messages: InboxMessage[]) {
  const last = messages[messages.length - 1]
  return {
    preview: last ? (last.subject ? `${last.subject} · ${last.text}` : last.text).slice(0, 140) : '',
    lastAt: last?.at ?? null,
    needsReply: last?.who === 'them',
  }
}

/** Buyers and projects behind offer chats (`offer:<slug>:<contact id>`). */
async function contactsFor(userId: string, conversations: Conversation[]) {
  const offerIds = conversations.filter((c) => c.externalId.startsWith('offer:')).map((c) => c.externalId.split(':'))
  const ids = offerIds.map((parts) => parts[2]).filter((id): id is string => Boolean(id && isUuid(id)))
  const slugs = [...new Set(offerIds.map((parts) => parts[1]).filter((slug): slug is string => Boolean(slug)))]
  const [rows, offers] = await Promise.all([
    ids.length
      ? prismaClient.contact.findMany({ where: { userId, id: { in: ids } }, select: { id: true, name: true, email: true, phone: true } })
      : [],
    slugs.length ? prismaClient.webinar.findMany({ where: { slug: { in: slugs }, presenterId: userId }, select: { slug: true, title: true } }) : [],
  ])
  return Object.assign(new Map(rows.map((r) => [r.id, r])), { offers: new Map(offers.map((o) => [o.slug, o.title])) })
}

function describeConversation(c: Conversation, index: LeadIndex, contacts: Awaited<ReturnType<typeof contactsFor>>): InboxThread {
  const source = sourceOf(c.externalId)
  const key = c.externalId.slice(c.externalId.indexOf(':') + 1)
  let title = 'Website visitor'
  let lead: InboxLead | null = null
  let context: string | null = null
  if (source === 'whatsapp') {
    title = /^\d+$/.test(key) ? `+${key}` : 'WhatsApp contact'
    lead = index.byPhone.get(phoneKey(key)) ?? null
  } else if (source === 'email') {
    title = key
    lead = index.byEmail.get(key.toLowerCase()) ?? null
  } else if (source === 'assistant') {
    const firstAsk = readStoredMessages(c.messages).find((m) => m.role === 'user')?.content.trim()
    title = firstAsk ? firstAsk.replace(/\s+/g, ' ').slice(0, 48) : 'New chat'
  } else if (source === 'offer') {
    const [, slug = '', contactId = ''] = c.externalId.split(':')
    const contact = contacts.get(contactId)
    title = contact?.name || contact?.email || contact?.phone || 'Buyer'
    context = contacts.offers.get(slug) ?? null
    lead =
      (contact?.email ? index.byEmail.get(contact.email.toLowerCase()) : undefined) ??
      (contact?.phone ? index.byPhone.get(phoneKey(contact.phone)) : undefined) ??
      null
  }
  const summary = summarize(toInboxMessages(readStoredMessages(c.messages), '', source === 'assistant'))
  return {
    id: c.id,
    conversationId: c.id,
    hasDraft: false,
    source,
    title: lead?.name ?? title,
    ...summary,
    // A new partner chat has no messages yet but still shows in the list.
    ...(source === 'assistant'
      ? { preview: summary.preview || 'Ask your apps with /n8n, /medusa…', lastAt: summary.lastAt ?? c.updatedAt.toISOString(), needsReply: false }
      : {}),
    aiPaused: Boolean(c.aiPausedAt),
    lead,
    context,
  }
}

/** Voice calls a buyer had with an offer's AI, as cards in the thread. */
async function offerCalls(userId: string, externalId: string): Promise<InboxMessage[]> {
  const [, slug, contactId] = externalId.split(':')
  if (!slug || !contactId) return []
  const calls = await prismaClient.callTranscript.findMany({
    where: { userId, roomName: { contains: `__offer__${slug}__${contactId.replace(/-/g, '').toLowerCase()}` } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, createdAt: true, duration: true, summary: true, outcome: true, transcript: true },
  })
  return calls.map((call) => ({
    id: `call:${call.id}`,
    who: 'call' as const,
    text: call.summary || 'Voice call',
    at: call.createdAt.toISOString(),
    call: {
      durationSec: call.duration,
      outcome: call.outcome,
      lines: (Array.isArray(call.transcript) ? call.transcript : [])
        .filter(
          (line): line is { role: 'user' | 'agent'; text: string } =>
            !!line &&
            typeof line === 'object' &&
            ((line as { role?: string }).role === 'user' || (line as { role?: string }).role === 'agent') &&
            typeof (line as { text?: unknown }).text === 'string',
        )
        .map(({ role, text }) => ({ role, text })),
    },
  }))
}

/* -------------------------------------------------------------- instagram */

/**
 * One Instagram thread per person: their comments and the campaign DM (comment-to-DM jobs), plus
 * the DMs they sent back and the creator's replies (stored as `instagram:<sender id>`).
 */
async function instagramThreads(userId: string, index: LeadIndex, conversations: Conversation[], only?: string) {
  const jobs = await prismaClient.instagramDmJob.findMany({
    where: { userId, ...(only ? { commenterId: only } : {}) },
    orderBy: { createdAt: 'desc' },
    take: only ? 50 : 300,
    select: {
      id: true,
      commenterId: true,
      commenterUsername: true,
      commentText: true,
      status: true,
      error: true,
      leadId: true,
      createdAt: true,
      updatedAt: true,
      campaign: { select: { dmText: true, linkUrl: true } },
    },
  })
  const people = new Map<string, { jobs: typeof jobs; conversation?: Conversation }>()
  for (const job of jobs) {
    const entry = people.get(job.commenterId) ?? { jobs: [] }
    entry.jobs.push(job)
    people.set(job.commenterId, entry)
  }
  for (const c of conversations) {
    if (!c.externalId.startsWith('instagram:')) continue
    const id = c.externalId.slice('instagram:'.length)
    if (only && id !== only) continue
    people.set(id, { jobs: people.get(id)?.jobs ?? [], conversation: c })
  }

  return [...people.entries()].map(([senderId, entry]) => {
    const messages: InboxMessage[] = []
    for (const job of [...entry.jobs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
      messages.push({ id: `${job.id}:c`, who: 'them', text: `Commented: ${job.commentText}`, at: job.createdAt.toISOString() })
      if (job.status === 'SENT') {
        const dm = [job.campaign.dmText.replace('{username}', job.commenterUsername ?? ''), job.campaign.linkUrl].filter(Boolean).join('\n')
        messages.push({ id: `${job.id}:dm`, who: 'ai', text: dm, at: job.updatedAt.toISOString() })
      } else if (job.status === 'FAILED') {
        messages.push({ id: `${job.id}:f`, who: 'ai', text: `DM not sent: ${job.error ?? 'failed'}`, at: job.updatedAt.toISOString() })
      }
    }
    if (entry.conversation) messages.push(...toInboxMessages(readStoredMessages(entry.conversation.messages), 'dm'))
    messages.sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''))

    const leadId = entry.jobs.find((j) => j.leadId)?.leadId
    const lead = leadId ? (index.byId.get(leadId) ?? null) : null
    const username = entry.jobs.find((j) => j.commenterUsername)?.commenterUsername
    const summary = summarize(messages)
    const thread: InboxThread = {
      id: `ig:${senderId}`,
      conversationId: entry.conversation?.id ?? null,
      hasDraft: false,
      source: 'instagram',
      title: lead?.name ?? (username ? `@${username}` : 'Instagram user'),
      ...summary,
      // Only a DM they sent waits for an answer (a comment was already answered by the campaign).
      needsReply: summary.needsReply && !messages[messages.length - 1]?.text.startsWith('Commented: '),
      aiPaused: false,
      lead,
      context: null,
    }
    return { thread, messages }
  })
}

/* ------------------------------------------------------------------- read */

export async function listInbox(userId: string): Promise<InboxThread[]> {
  const [conversations, index] = await Promise.all([ownedConversations(userId), leadIndex(userId)])
  const contacts = await contactsFor(userId, conversations)
  const threads = conversations.filter((c) => !c.externalId.startsWith('instagram:')).map((c) => describeConversation(c, index, contacts))
  const ig = await instagramThreads(userId, index, conversations)
  const all = [...threads, ...ig.map((i) => i.thread)]
  const drafts = await prismaClient.messageDraft.findMany({
    where: { userId, conversationId: { in: all.map((t) => t.conversationId).filter((id): id is string => Boolean(id)) } },
    select: { conversationId: true, subject: true, body: true, updatedAt: true },
  })
  const draftBy = new Map(drafts.map((d) => [d.conversationId, d]))
  return all
    .map((t) => {
      const draft = t.conversationId ? draftBy.get(t.conversationId) : undefined
      if (!draft) return t
      // A thread that only has a draft (a new email to a lead) shows the draft as its preview.
      return {
        ...t,
        hasDraft: true,
        preview: t.preview || `Draft: ${draft.subject ? `${draft.subject} · ` : ''}${draft.body}`.slice(0, 140),
        lastAt: t.lastAt && t.lastAt > draft.updatedAt.toISOString() ? t.lastAt : draft.updatedAt.toISOString(),
      }
    })
    .filter((t) => t.preview)
    .sort((a, b) => ((a.lastAt ?? '') < (b.lastAt ?? '') ? 1 : -1))
}

function windowNote(messages: InboxMessage[], channel: string): { open: boolean; note: string } {
  const lastTheirs = [...messages].reverse().find((m) => m.who === 'them' && !m.text.startsWith('Commented: '))
  const left = (lastTheirs?.at ? new Date(lastTheirs.at).getTime() : 0) + REPLY_WINDOW_MS - Date.now()
  if (left <= 0) {
    return {
      open: false,
      note: `${channel} only allows replies within 24 hours of their last message. They need to write to you again first.`,
    }
  }
  return { open: true, note: `Reply window: ${Math.max(1, Math.floor(left / 3_600_000))} h left.` }
}

export async function loadThread(userId: string, threadId: string): Promise<ThreadDetail | null> {
  const thread = await loadThreadWithoutDraft(userId, threadId)
  if (!thread) return null
  const draft = thread.conversationId
    ? await prismaClient.messageDraft.findFirst({
        where: { userId, conversationId: thread.conversationId },
        select: { kind: true, source: true, subject: true, body: true, note: true, updatedAt: true },
      })
    : null
  return { ...thread, draft: draft ? toDraftView(draft) : null, hasDraft: Boolean(draft) }
}

async function loadThreadWithoutDraft(userId: string, threadId: string): Promise<Omit<ThreadDetail, 'draft'> | null> {
  const index = await leadIndex(userId)

  if (threadId.startsWith('ig:')) {
    const senderId = threadId.slice(3)
    if (!/^[0-9A-Za-z_-]{1,64}$/.test(senderId)) return null
    const conversations = await ownedConversations(userId, { externalIds: [`instagram:${senderId}`] })
    const [found] = await instagramThreads(userId, index, conversations, senderId)
    if (!found) return null
    if (!(await instagramTokenFor(userId))) {
      return { ...found.thread, messages: found.messages, canReply: false, replyNote: 'Connect Instagram in Integrations to reply.' }
    }
    const window = windowNote(found.messages, 'Instagram')
    return { ...found.thread, messages: found.messages, canReply: window.open, replyNote: window.note }
  }

  // Projects → Pipeline links to a buyer's chat by its key.
  const [conversation] = threadId.startsWith('offer:')
    ? await ownedConversations(userId, { externalIds: [threadId.slice(0, 128)] })
    : isUuid(threadId)
      ? await ownedConversations(userId, { id: threadId })
      : []
  if (!conversation || conversation.externalId.startsWith('instagram:')) return null
  const contacts = await contactsFor(userId, [conversation])
  const thread = describeConversation(conversation, index, contacts)
  const stored = readStoredMessages(conversation.messages)
  const messages = toInboxMessages(stored, '', thread.source === 'assistant')
  if (thread.source === 'assistant') {
    return { ...thread, messages, canReply: true, replyNote: 'Type / to pick an app. Changes wait for you to confirm.' }
  }
  if (thread.source === 'offer') {
    messages.push(...(await offerCalls(userId, conversation.externalId)))
    messages.sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''))
  }

  if (thread.source === 'whatsapp') {
    if (!(await decryptedApiKey(userId))) return { ...thread, messages, canReply: false, replyNote: 'Connect WhatsApp in Integrations to reply.' }
    const window = windowNote(messages, 'WhatsApp')
    return { ...thread, messages, canReply: window.open, replyNote: window.open ? `${window.note} Replying takes the chat over from the AI.` : window.note }
  }
  if (thread.source === 'email') {
    const lastSubject = [...stored].reverse().find((m) => m.subject)?.subject
    const replySubject = lastSubject ? (/^re:/i.test(lastSubject) ? lastSubject : `Re: ${lastSubject}`) : 'Hello'
    if ((await emailSourceFor(userId)) !== 'creator') {
      return { ...thread, messages, canReply: false, replyNote: 'Connect your email in Integrations to send from your own address.', replySubject }
    }
    return { ...thread, messages, canReply: true, replyNote: 'Sent from your mailbox; their answer arrives in your email inbox.', replySubject }
  }
  return { ...thread, messages, canReply: true, replyNote: 'They see your reply in their chat when they come back. Replying takes the chat over from the AI.' }
}

/* ------------------------------------------------------------------ write */

async function logLeadActivity(userId: string, leadId: string, note: string) {
  const lead = await prismaClient.callIntelLead.findFirst({ where: { id: leadId, userId }, select: { outboundStatus: true } })
  if (!lead) return
  await prismaClient.leadActivity.create({
    data: { userId, leadId, type: lead.outboundStatus === 'NEW' ? 'APPROACH' : 'FOLLOW_UP', note: note.slice(0, 500) },
  })
  if (lead.outboundStatus === 'NEW') await prismaClient.callIntelLead.update({ where: { id: leadId }, data: { outboundStatus: 'ON_PROCESS' } })
}

/** Sends a reply on the thread's channel and stores it. */
export async function sendInboxReply(
  userId: string,
  threadId: string,
  input: { text: string; subject?: string; from?: 'creator' | 'agent' },
) {
  await sendInboxReplyNow(userId, threadId, input)
  // Sent: the draft it came from is done. (An Instagram thread's conversation may be new.)
  const thread = await loadThreadWithoutDraft(userId, threadId)
  if (thread?.conversationId) await deleteDraft(userId, thread.conversationId)
}

async function sendInboxReplyNow(
  userId: string,
  threadId: string,
  input: { text: string; subject?: string; from?: 'creator' | 'agent' },
) {
  const from = input.from ?? 'creator'
  const text = input.text.trim().slice(0, REPLY_MAX)
  if (!text) throw new Error('Write a message first.')
  const thread = await loadThread(userId, threadId)
  if (!thread) throw new Error('That conversation is gone.')
  if (!thread.canReply) throw new Error(thread.replyNote ?? 'You can’t reply on this channel now.')
  const business = await getCreatorBusiness(userId)
  if (!business) throw new Error('Set up your business first.')
  const now = new Date().toISOString()
  const who = from === 'agent' ? 'Your AI agent' : 'You'

  if (thread.source === 'instagram') {
    const senderId = threadId.slice(3)
    const connection = await instagramTokenFor(userId)
    if (!connection) throw new Error('Connect Instagram in Integrations to reply.')
    await sendDirectMessage(connection.token, senderId, text)
    await appendToConversation({
      roomName: business.roomName,
      userId,
      externalId: `instagram:${senderId}`,
      messages: [{ role: 'assistant', from, content: text, timestamp: now }],
    })
    if (thread.lead) await logLeadActivity(userId, thread.lead.id, `${who} replied on Instagram: ${text}`)
    return
  }

  if (thread.source === 'assistant') throw new Error('Partner chats are answered by the partner assistant.')
  const [conversation] = await ownedConversations(userId, { id: thread.id })
  if (!conversation) throw new Error('That conversation is gone.')
  const externalId = conversation.externalId

  if (thread.source === 'email') {
    const to = externalId.slice('email:'.length)
    const subject = (input.subject?.trim() || thread.replySubject || 'Hello').slice(0, 200)
    const sent = await sendPlainEmail({ userId, to, subject, text, fromName: business.name })
    if (!sent) throw new Error('The email could not be sent. Check your email connection.')
    await appendToConversationById(conversation.id, [{ role: 'assistant', from, content: text, subject, timestamp: now }])
    if (thread.lead) await logLeadActivity(userId, thread.lead.id, `${who} emailed: ${subject}`)
    return
  }

  if (thread.source === 'whatsapp') {
    const connection = await decryptedApiKey(userId)
    if (!connection) throw new Error('Connect WhatsApp in Integrations to reply.')
    const key = externalId.slice('whatsapp:'.length)
    await sendText({ ...connection, to: /^\d+$/.test(key) ? { phone: key } : { userId: key }, body: text })
  }
  // The conversation's own room: an offer chat may live on the project's AI agent, not the business one.
  await appendToConversationById(conversation.id, [{ role: 'assistant', from, content: text, timestamp: now }], { pause: true })
  if (thread.lead) {
    await logLeadActivity(userId, thread.lead.id, `${who} replied on ${thread.source === 'whatsapp' ? 'WhatsApp' : 'the chat'}: ${text}`)
  }
}

export async function setThreadAiPaused(userId: string, threadId: string, paused: boolean) {
  const [conversation] = threadId.startsWith('offer:')
    ? await ownedConversations(userId, { externalIds: [threadId.slice(0, 128)] })
    : isUuid(threadId)
      ? await ownedConversations(userId, { id: threadId })
      : []
  if (!conversation) throw new Error('That conversation is gone.')
  await prismaClient.messageConversation.update({ where: { id: conversation.id }, data: { aiPausedAt: paused ? new Date() : null } })
}

/** Leads with a real email address, for "New email". */
export async function emailableLeads(userId: string, search: string) {
  const leads = await prismaClient.callIntelLead.findMany({
    where: {
      userId,
      ...(search
        ? { OR: ['name', 'company', 'email', 'position'].map((field) => ({ [field]: { contains: search, mode: 'insensitive' as const } })) }
        : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 40,
    select: { id: true, name: true, company: true, email: true, outboundStatus: true },
  })
  return leads
    .filter((l) => isDeliverableEmail(l.email))
    .slice(0, 20)
    .map((l) => ({ id: l.id, name: l.company || l.name, email: l.email, status: l.outboundStatus }))
}

/** Emails a lead from the creator's own mailbox, starts (or continues) the thread and logs it on the lead. */
export async function sendLeadEmail(userId: string, input: { leadId: string; subject: string; text: string; from: 'creator' | 'agent' }) {
  const lead = await prismaClient.callIntelLead.findFirst({ where: { id: input.leadId, userId }, select: { email: true } })
  if (!lead || !isDeliverableEmail(lead.email)) throw new Error('That lead has no email address.')
  if ((await emailSourceFor(userId)) !== 'creator') throw new Error('Connect your email in Integrations to send from your own address.')
  const business = await getCreatorBusiness(userId)
  if (!business) throw new Error('Set up your business first.')
  const subject = input.subject.trim().slice(0, 200)
  const text = input.text.trim().slice(0, 10_000)
  if (!subject || !text) throw new Error('Write a subject and a message.')
  const sent = await sendPlainEmail({ userId, to: lead.email, subject, text, fromName: business.name })
  if (!sent) throw new Error('The email could not be sent. Check your email connection.')
  const conversation = await appendToConversation({
    roomName: business.roomName,
    userId,
    externalId: `email:${lead.email.toLowerCase()}`,
    messages: [{ role: 'assistant', from: input.from, content: text, subject, timestamp: new Date().toISOString() }],
  })
  await logLeadActivity(userId, input.leadId, `${input.from === 'agent' ? 'Your AI agent' : 'You'} emailed: ${subject}`)
  return { threadId: conversation.id, to: lead.email }
}

/* ------------------------------------------------------------ partner chats */

/** Starts a partner chat (asking the apps connected in Integrations). It lists like any conversation. */
export async function createAssistantChat(userId: string): Promise<{ threadId: string }> {
  const business = await getCreatorBusiness(userId)
  if (!business) throw new Error('Set up your business first.')
  const conversation = await appendToConversation({
    roomName: business.roomName,
    userId,
    externalId: `assistant:${crypto.randomUUID()}`,
    messages: [],
  })
  return { threadId: conversation.id }
}

/** Saves one turn of a partner chat: what the creator asked (if anything) and the assistant's answer. */
export async function saveAssistantTurn(userId: string, threadId: string, input: { ask?: string; reply: string }) {
  if (!isUuid(threadId)) throw new Error('That conversation is gone.')
  const [conversation] = await ownedConversations(userId, { id: threadId })
  if (!conversation || !conversation.externalId.startsWith('assistant:')) throw new Error('That conversation is gone.')
  const now = new Date().toISOString()
  const messages: StoredMessage[] = []
  const ask = input.ask?.trim().slice(0, REPLY_MAX)
  if (ask) messages.push({ role: 'user', from: 'creator', content: ask, timestamp: now })
  const reply = input.reply.trim().slice(0, 20_000)
  if (reply) messages.push({ role: 'assistant', content: reply, timestamp: now })
  if (messages.length) await appendToConversationById(conversation.id, messages)
}
