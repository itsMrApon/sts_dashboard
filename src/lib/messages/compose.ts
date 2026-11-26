import 'server-only'
import { prismaClient } from '@/lib/prismaClient'
import { decryptToken } from '@/lib/messages/encrypt'
import { generateReply } from '@/lib/messages/geminiText'
import { getUserVoiceCredentialByUserId } from '@/lib/voiceCredentialsRepo'
import { loadBusinessBrain } from '@/lib/mcp/businessBrain'
import { draftLeadEmail, ensureConversation, saveDraft, type DraftKind } from './drafts'
import { loadThread } from './inbox'

/**
 * "Write with AI" in Messages. The AI only writes: the result is saved as the
 * conversation's draft, and the creator reads, edits and clicks Send.
 */

export const COMPOSE_KINDS = ['reply', 'message', 'email', 'greeting', 'offer', 'deadline'] as const
export type ComposeKind = (typeof COMPOSE_KINDS)[number]

const KIND_BRIEF: Record<ComposeKind, string> = {
  reply: 'Answer their last message directly and helpfully. End with one clear next step.',
  message: 'Write a short, friendly message that moves the conversation forward with one clear ask.',
  email: 'Write a short email: a specific opening, why it matters to them, one clear ask.',
  greeting: 'Write a warm greeting (for the occasion in the creator’s note, or a simple check-in). No hard selling.',
  offer: 'Announce one offer from the business’s offers that fits this person, with its link. Say why it fits them.',
  deadline: 'Remind them about a deadline (an offer ending, a booking slot, a service date) from the creator’s note. Friendly, specific, one ask.',
}

const NO_KEY = 'Add your Gemini API key in Settings to use Write with AI.'

async function geminiKey(userId: string) {
  const cred = await getUserVoiceCredentialByUserId(userId)
  try {
    return decryptToken(cred?.googleApiKey) || null
  } catch {
    return null
  }
}

function parseEmail(text: string): { subject: string; body: string } {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
  try {
    const json = JSON.parse(cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1)) as { subject?: unknown; body?: unknown }
    if (typeof json.body === 'string' && json.body.trim()) {
      return { subject: typeof json.subject === 'string' ? json.subject.trim() : '', body: json.body.trim() }
    }
  } catch {
    // Not JSON: first line as the subject when it looks like one.
  }
  const lines = cleaned.split('\n')
  const first = lines[0]?.replace(/^subject:\s*/i, '').trim() ?? ''
  return first.length <= 120 && lines.length > 2 ? { subject: first, body: lines.slice(1).join('\n').trim() } : { subject: '', body: cleaned }
}

async function leadBrief(userId: string, leadId: string) {
  const lead = await prismaClient.callIntelLead.findFirst({
    where: { id: leadId, userId },
    select: { name: true, company: true, position: true, website: true, mapsCategory: true, notes: true, outboundStatus: true, webResearchJson: true },
  })
  if (!lead) return null
  const research = lead.webResearchJson ? JSON.stringify(lead.webResearchJson).slice(0, 1500) : null
  return [
    `Lead: ${lead.name}${lead.company ? ` at ${lead.company}` : ''}${lead.position ? ` (${lead.position})` : ''}`,
    lead.mapsCategory ? `Business type: ${lead.mapsCategory}` : null,
    lead.website ? `Website: ${lead.website}` : null,
    `Status: ${lead.outboundStatus}`,
    lead.notes ? `Creator's notes: ${lead.notes.slice(0, 800)}` : null,
    research ? `Research about them: ${research}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

async function write(userId: string, input: { kind: ComposeKind; channel: string; asEmail: boolean; context: string; note?: string }) {
  const apiKey = await geminiKey(userId)
  if (!apiKey) throw new Error(NO_KEY)
  const brain = await loadBusinessBrain(userId)
  if (!brain) throw new Error('Set up your business first.')
  const offers = brain.offers.map((o) => `- ${o.name}: ${o.url}`).join('\n') || '(no live offers)'

  const systemPrompt = [
    `You write messages for the business "${brain.name}", as the business, to send from ${input.channel}.`,
    brain.description ? `About the business: ${brain.description}` : null,
    `Offers:\n${offers}`,
    brain.businessPageUrl ? `Business page: ${brain.businessPageUrl}` : null,
    `Business knowledge:\n${brain.knowledge.slice(0, 4000)}`,
    'Rules: reply in the language the customer used (Bangla stays in Bangla script, never transliterated); short and human, no buzzwords; never invent prices, discounts, dates or promises that are not in the business knowledge or the creator’s note; no placeholders like [Name].',
    input.asEmail
      ? 'Return only JSON: {"subject": "...", "body": "..."} with a plain-text body (no markdown).'
      : 'Return only the message text, plain (no markdown, no quotes).',
  ]
    .filter(Boolean)
    .join('\n\n')

  const userMessage = [`Task: ${KIND_BRIEF[input.kind]}`, input.note ? `Creator's note: ${input.note}` : null, input.context].filter(Boolean).join('\n\n')
  const result = await generateReply({ userMessage, history: [], systemPrompt, apiKey, accountUserId: userId, usageSurface: 'messages' })
  if (!result.ok) throw new Error(result.code === 'NO_API_KEY' ? NO_KEY : result.error)
  return input.asEmail ? parseEmail(result.text) : { subject: '', body: result.text.trim() }
}

/** Writes a draft for an existing conversation and saves it there. */
export async function composeThreadDraft(userId: string, threadId: string, kind: ComposeKind, note?: string) {
  const thread = await loadThread(userId, threadId)
  if (!thread) throw new Error('That conversation is gone.')
  if (thread.source === 'assistant') throw new Error('Partner chats have no customer to write to.')
  const asEmail = thread.source === 'email'
  const recent = thread.messages
    .filter((m) => m.who !== 'call')
    .slice(-12)
    .map((m) => `${m.who === 'them' ? 'Customer' : 'Business'}: ${m.subject ? `[${m.subject}] ` : ''}${m.text}`)
    .join('\n')
  const lead = thread.lead ? await leadBrief(userId, thread.lead.id) : null
  const channel = { whatsapp: 'WhatsApp', instagram: 'Instagram DM', email: 'email', website: 'the website chat', offer: 'the offer chat' }[thread.source as Exclude<typeof thread.source, 'assistant'>]
  const draft = await write(userId, {
    kind,
    channel,
    asEmail,
    note,
    context: [lead, recent ? `Conversation so far:\n${recent}` : 'No messages yet.'].filter(Boolean).join('\n\n'),
  })
  const conversationId = thread.conversationId ?? (await ensureConversation(userId, `instagram:${threadId.slice(3)}`))
  await saveDraft({
    userId,
    conversationId,
    kind: kind as DraftKind,
    source: 'ai',
    subject: asEmail ? draft.subject || thread.draft?.subject || null : null,
    body: draft.body,
  })
  return loadThread(userId, threadId)
}

/** Writes a draft email to a lead (Lead → List) and puts it in their email thread. */
export async function composeLeadEmail(userId: string, leadId: string, kind: ComposeKind, note?: string) {
  const lead = await leadBrief(userId, leadId)
  if (!lead) throw new Error('That lead is gone.')
  const draft = await write(userId, { kind, channel: 'email', asEmail: true, note, context: `${lead}\n\nThis is a first email: they have not written yet.` })
  return draftLeadEmail({ userId, leadId, kind: kind as DraftKind, source: 'ai', subject: draft.subject || 'Hello', body: draft.body })
}
