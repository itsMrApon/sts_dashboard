import { Prisma } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { generateReply } from '@/lib/messages/geminiText'
import { resolveUserGeminiApiKey } from '@/lib/leads/resolveUserLlmKey'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'

/**
 * The Questions job for one creator: pulls the questions customers asked in chats and forms
 * (last 90 days), removes personal details, groups them by meaning with the creator's own
 * Gemini key, and saves the groups per project (General when a chat was about no project).
 * The creator's status and answer on a group survive every run.
 *
 * Grouping goes through `groupQuestions` only, so a dedicated worker (embeddings + topic model)
 * can replace it once volume grows, without touching the rest.
 */

const WINDOW_DAYS = 90
const QUIET_AFTER_MS = 24 * 60 * 60 * 1000
const MAX_CONVERSATIONS = 1000
const MAX_QUESTIONS_PER_PROJECT = 150
const MAX_EXAMPLES = 5
const MIN_LENGTH = 6
const MAX_LENGTH = 300

type StoredMessage = { role?: string; content?: string; timestamp?: string }

type Candidate = {
  /** Project (Webinar id) the chat was about, or null for General. */
  projectId: string | null
  text: string
  askedAt: Date
  wentQuiet: boolean
}

export type QuestionsRunSummary =
  | { status: 'skipped'; reason: 'no-questions' | 'no-gemini-key' }
  | { status: 'done'; questions: number; groups: number; projects: number; errors: string[] }

// English question words plus common Bangla ones (কী/কি, কেন, কীভাবে/কিভাবে, কখন, কোথায়, কত, কোন).
const QUESTION_START =
  /^(what|how|when|where|why|who|which|can|could|do|does|did|is|are|will|would|should|any|price|cost)\b/i
const BANGLA_QUESTION = /(কী|কি|কেন|কীভাবে|কিভাবে|কখন|কোথায়|কত|কোন|আছে কি|পারি)/

/** A visitor message worth treating as a question: has a question mark or starts like one. */
export function looksLikeQuestion(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) return false
  if (trimmed.startsWith('[Uploaded:')) return false
  return /[?？]/.test(trimmed) || QUESTION_START.test(trimmed) || BANGLA_QUESTION.test(trimmed)
}

/**
 * Removes contact details before anything leaves the database. Letters (Bangla included) are
 * never changed; only emails, links, handles, phone and long card/ID-like numbers are replaced.
 */
export function redactPersonalDetails(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/https?:\/\/\S+|www\.\S+/gi, '[link]')
    .replace(/(^|\s)@[\w.]{2,}/g, '$1[handle]')
    .replace(/\+?[\d০-৯][\d০-৯\s().-]{6,}[\d০-৯]/g, '[number]')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeForCount(text: string): string {
  return text.toLowerCase().replace(/[?？!.,।\s]+/g, ' ').trim()
}

/** Creators who have at least one saved conversation. */
export async function listQuestionCreators(): Promise<string[]> {
  const rows = await prismaClient.messageChannel.findMany({
    where: { userId: { not: null }, conversations: { some: {} } },
    select: { userId: true },
    distinct: ['userId'],
  })
  return rows.flatMap((row) => (row.userId ? [row.userId] : []))
}

async function loadCandidates(userId: string, now: Date): Promise<Candidate[]> {
  const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const [offers, conversations, business] = await Promise.all([
    prismaClient.webinar.findMany({
      where: { presenterId: userId, deletedAt: null, slug: { not: null } },
      select: { id: true, slug: true },
    }),
    prismaClient.messageConversation.findMany({
      // Partner chats (`assistant:`) are the creator talking to their apps, not customer questions.
      where: { channel: { userId }, updatedAt: { gte: since }, NOT: { externalId: { startsWith: 'assistant:' } } },
      orderBy: { updatedAt: 'desc' },
      take: MAX_CONVERSATIONS,
      select: { externalId: true, messages: true, updatedAt: true },
    }),
    getCreatorBusiness(userId),
  ])
  const projectBySlug = new Map(offers.map((offer) => [offer.slug as string, offer.id]))
  const candidates: Candidate[] = []

  for (const conversation of conversations) {
    // Offer chats are keyed "offer:<slug>:<contact>"; everything else is General.
    const slug = conversation.externalId.startsWith('offer:') ? conversation.externalId.split(':')[1] : null
    const projectId = slug ? projectBySlug.get(slug) ?? null : null
    const messages = Array.isArray(conversation.messages) ? (conversation.messages as StoredMessage[]) : []
    const lastUserIndex = messages.map((message) => message.role).lastIndexOf('user')
    const quietConversation = now.getTime() - conversation.updatedAt.getTime() > QUIET_AFTER_MS

    messages.forEach((message, index) => {
      if (message.role !== 'user' || typeof message.content !== 'string') return
      if (!looksLikeQuestion(message.content)) return
      const answeredThenSilence =
        index === lastUserIndex && messages[index + 1]?.role === 'assistant' && quietConversation
      const askedAt = message.timestamp ? new Date(message.timestamp) : conversation.updatedAt
      candidates.push({
        projectId,
        text: redactPersonalDetails(message.content),
        askedAt: Number.isNaN(askedAt.getTime()) ? conversation.updatedAt : askedAt,
        wentQuiet: answeredThenSilence,
      })
    })
  }

  // Free-text form answers that ask something are questions too (General: forms have no project).
  if (business?.workspaceId) {
    const submissions = await prismaClient.formSubmission.findMany({
      where: { workspaceId: business.workspaceId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { fields: true, createdAt: true },
    })
    for (const submission of submissions) {
      const answers = (submission.fields as { answers?: { type?: string; value?: string }[] } | null)?.answers ?? []
      for (const answer of answers) {
        if ((answer.type === 'text' || answer.type === 'textarea') && answer.value && looksLikeQuestion(answer.value)) {
          candidates.push({
            projectId: null,
            text: redactPersonalDetails(answer.value),
            askedAt: submission.createdAt,
            wentQuiet: false,
          })
        }
      }
    }
  }
  return candidates
}

type Assignment = { id: string; label: string | null }

function parseAssignments(text: string): Assignment[] {
  const json = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
  const start = json.indexOf('{')
  const end = json.lastIndexOf('}')
  if (start < 0 || end < start) return []
  try {
    const parsed = JSON.parse(json.slice(start, end + 1)) as { assignments?: unknown }
    if (!Array.isArray(parsed.assignments)) return []
    return parsed.assignments.flatMap((item) => {
      const entry = item as { id?: unknown; label?: unknown }
      if (typeof entry.id !== 'string') return []
      const label = typeof entry.label === 'string' ? entry.label.trim().slice(0, 200) : null
      return [{ id: entry.id, label: label || null }]
    })
  } catch {
    return []
  }
}

/**
 * Asks Gemini which group each question belongs to. Existing labels are offered first so the
 * same question keeps the same group (and its answer) from week to week.
 */
export async function groupQuestions(input: {
  userId: string
  apiKey: string
  questions: { id: string; text: string }[]
  existingLabels: string[]
}): Promise<Map<string, string>> {
  const systemPrompt = [
    'You group the questions a small business’s customers asked, so the owner can answer each kind once.',
    'Put questions that ask the same thing in the same group, even when worded differently or in another language.',
    'Use an existing group label when it fits. Otherwise write a new short label (at most 8 words) that reads like the question, in the language most of its questions use. Keep Bangla in Bengali script.',
    'Give label null to greetings, small talk, tests, and anything that is not a real question about the business.',
    'Reply with JSON only: {"assignments":[{"id":"q1","label":"..."}]}',
    `Existing group labels: ${input.existingLabels.length ? JSON.stringify(input.existingLabels) : 'none'}`,
  ].join('\n')
  const result = await generateReply({
    userMessage: JSON.stringify(input.questions),
    history: [],
    systemPrompt,
    apiKey: input.apiKey,
    accountUserId: input.userId,
    usageSurface: 'questions',
  })
  if (!result.ok) throw new Error(result.error)
  const labels = new Map<string, string>()
  for (const assignment of parseAssignments(result.text)) {
    if (assignment.label) labels.set(assignment.id, assignment.label)
  }
  return labels
}

type GroupTotals = { askedCount: number; wentQuietCount: number; lastAskedAt: Date; examples: { text: string; at: Date }[] }

async function saveGroups(userId: string, projectId: string | null, totals: Map<string, GroupTotals>) {
  const existing = await prismaClient.questionGroup.findMany({
    where: { userId, webinarId: projectId },
    select: { id: true, label: true },
  })
  const byLabel = new Map(existing.map((group) => [group.label, group.id]))

  for (const [label, total] of totals) {
    const examples = [...new Map(total.examples.sort((a, b) => b.at.getTime() - a.at.getTime()).map((ex) => [normalizeForCount(ex.text), ex.text])).values()]
      .slice(0, MAX_EXAMPLES) as Prisma.InputJsonValue
    const data = {
      askedCount: total.askedCount,
      wentQuietCount: total.wentQuietCount,
      lastAskedAt: total.lastAskedAt,
      examples,
    }
    const id = byLabel.get(label)
    if (id) await prismaClient.questionGroup.update({ where: { id }, data })
    else await prismaClient.questionGroup.create({ data: { userId, webinarId: projectId, label, ...data } })
  }

  // Groups nobody asked about in the window drop to zero; answered ones keep their answer.
  const seen = new Set(totals.keys())
  const stale = existing.filter((group) => !seen.has(group.label)).map((group) => group.id)
  if (stale.length) {
    await prismaClient.questionGroup.updateMany({ where: { id: { in: stale } }, data: { askedCount: 0, wentQuietCount: 0 } })
  }
}

export async function runQuestionsForCreator(userId: string, now = new Date()): Promise<QuestionsRunSummary> {
  const candidates = await loadCandidates(userId, now)
  if (candidates.length === 0) return { status: 'skipped', reason: 'no-questions' }
  const apiKey = await resolveUserGeminiApiKey(userId)
  if (!apiKey) return { status: 'skipped', reason: 'no-gemini-key' }

  const byProject = new Map<string | null, Candidate[]>()
  for (const candidate of candidates) {
    const list = byProject.get(candidate.projectId) ?? []
    list.push(candidate)
    byProject.set(candidate.projectId, list)
  }

  const errors: string[] = []
  let groups = 0
  for (const [projectId, list] of byProject) {
    // Same question asked many times is sent once and counted every time.
    const unique = new Map<string, Candidate[]>()
    for (const candidate of list) {
      const key = normalizeForCount(candidate.text)
      unique.set(key, [...(unique.get(key) ?? []), candidate])
    }
    const entries = [...unique.values()].slice(0, MAX_QUESTIONS_PER_PROJECT)
    const existingLabels = (
      await prismaClient.questionGroup.findMany({ where: { userId, webinarId: projectId }, select: { label: true } })
    ).map((group) => group.label)

    let labels: Map<string, string>
    try {
      labels = await groupQuestions({
        userId,
        apiKey,
        questions: entries.map((same, index) => ({ id: `q${index + 1}`, text: same[0].text })),
        existingLabels,
      })
    } catch (err) {
      errors.push(`${projectId ?? 'general'}: ${err instanceof Error ? err.message : 'grouping failed'}`)
      continue
    }

    const totals = new Map<string, GroupTotals>()
    entries.forEach((same, index) => {
      const label = labels.get(`q${index + 1}`)
      if (!label) return
      const total = totals.get(label) ?? { askedCount: 0, wentQuietCount: 0, lastAskedAt: new Date(0), examples: [] }
      for (const candidate of same) {
        total.askedCount += 1
        if (candidate.wentQuiet) total.wentQuietCount += 1
        if (candidate.askedAt > total.lastAskedAt) total.lastAskedAt = candidate.askedAt
        total.examples.push({ text: candidate.text, at: candidate.askedAt })
      }
      totals.set(label, total)
    })
    await saveGroups(userId, projectId, totals)
    groups += totals.size
  }

  return { status: 'done', questions: candidates.length, groups, projects: byProject.size, errors }
}
