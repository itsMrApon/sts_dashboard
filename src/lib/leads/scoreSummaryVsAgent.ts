import { Prisma } from '@prisma/client'
import {
  cleanFathomSummaryText,
  formatFathomTranscript,
  getFathomMeeting,
} from '@/lib/fathom/client'
import { resolveUserGeminiApiKey } from '@/lib/leads/resolveUserLlmKey'
import {
  computeOverallScore,
  parseIssueItems,
  parseRubric,
  parseScoreLineItems,
  type ScoreGrade,
} from '@/lib/leads/scoreTypes'
import { decryptToken } from '@/lib/messages/encrypt'
import { generateReply } from '@/lib/messages/geminiText'
import { prismaClient } from '@/lib/prismaClient'

export type ScriptScoreResult = {
  covered: string[]
  missed: string[]
  issues: string[]
  nextSteps: string[]
  raw: Record<string, unknown>
}

const MAX_SCORE_HISTORY = 10

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fence ? fence[1].trim() : trimmed
  try {
    const parsed = JSON.parse(candidate) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as Record<
          string,
          unknown
        >
      } catch {
        return null
      }
    }
  }
  return null
}

function lineText(item: { text: string }): string {
  return item.text
}

function issueText(item: { text: string; severity?: string }): string {
  const prefix =
    item.severity && item.severity !== 'warning'
      ? `[${item.severity}] `
      : ''
  return `${prefix}${item.text}`
}

function normalizeParsedScore(
  parsed: Record<string, unknown>,
  source: 'summary' | 'transcript',
) {
  const coveredItems = parseScoreLineItems(parsed.covered, [])
  const missedItems = parseScoreLineItems(parsed.missed, [])
  const issueItems = parseIssueItems(parsed.issues, [])
  const rubric = parseRubric(parsed.rubric)

  const covered =
    coveredItems.length > 0
      ? coveredItems.map(lineText)
      : Array.isArray(parsed.covered)
        ? parsed.covered
            .map((v) => (typeof v === 'string' ? v.trim() : ''))
            .filter(Boolean)
        : []

  const missed =
    missedItems.length > 0
      ? missedItems.map(lineText)
      : Array.isArray(parsed.missed)
        ? parsed.missed
            .map((v) => (typeof v === 'string' ? v.trim() : ''))
            .filter(Boolean)
        : []

  const issues =
    issueItems.length > 0
      ? issueItems.map(issueText)
      : Array.isArray(parsed.issues)
        ? parsed.issues
            .map((v) => (typeof v === 'string' ? v.trim() : ''))
            .filter(Boolean)
        : []

  const nextSteps = Array.isArray(parsed.nextSteps)
    ? parsed.nextSteps
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean)
        .slice(0, 20)
    : []

  const overallScore = computeOverallScore({
    covered,
    missed,
    issues,
    rubric,
    rawScore: parsed.overallScore,
  })

  let grade = parsed.grade
  if (
    grade !== 'Strong' &&
    grade !== 'Needs coaching' &&
    grade !== 'Off-script'
  ) {
    grade =
      overallScore >= 75
        ? 'Strong'
        : overallScore >= 50
          ? 'Needs coaching'
          : 'Off-script'
  }

  return {
    covered,
    missed,
    issues,
    nextSteps,
    raw: {
      ...parsed,
      source,
      overallScore,
      grade: grade as ScoreGrade,
      coveredItems,
      missedItems,
      issueItems,
      rubric,
    },
  }
}

/** Old runs saved Gemini/env failures into issues[] — treat those as not scored. */
export function isFailedApiScore(score: {
  covered?: string[] | null
  missed?: string[] | null
  issues?: string[] | null
  nextSteps?: string[] | null
  rawJson?: unknown
}): boolean {
  const raw =
    score.rawJson && typeof score.rawJson === 'object'
      ? (score.rawJson as Record<string, unknown>)
      : null
  if (
    raw &&
    (raw.code === 'NO_API_KEY' ||
      raw.code === 'INVALID_API_KEY' ||
      raw.code === 'QUOTA_EXCEEDED' ||
      raw.code === 'MODEL_ERROR' ||
      typeof raw.error === 'string')
  ) {
    return true
  }

  const blob = [...(score.issues || []), ...(score.nextSteps || [])].join(' ')
  return /GOOGLE_API_KEY|Gemini API key|Config Agent|API key is missing|environment variables|\.env and restart|quota exceeded|invalid or revoked/i.test(
    blob,
  )
}

/**
 * Cross-check meeting content against /ai-agents systemPrompt rules.
 * Throws on Gemini/config failures so callers do not persist fake scores.
 */
/**
 * Compare scraped website intel (ScrapeGraphAI) to the agent playbook/prompt.
 * Used for Business leads instead of Fathom call summary scoring.
 */
export async function scoreScrapeVsAgent(options: {
  scrapeText: string
  systemPrompt: string
  apiKey?: string | null
  llmModel?: string | null
  accountUserId?: string | null
}): Promise<ScriptScoreResult> {
  const scrape = options.scrapeText.trim()
  const rules = options.systemPrompt.trim()
  if (!scrape) {
    throw new Error('No website scrape available to score. Open the lead to scrape first.')
  }
  if (!rules) {
    throw new Error(
      'Selected agent has an empty system prompt. Add rules on /ai-agents, then re-score.',
    )
  }
  if (!options.apiKey?.trim()) {
    throw new Error(
      'Gemini API key missing. Add it in Config Agent (/ai-agents/config).',
    )
  }

  const userMessage = `You are scoring a business prospect's website scrape against a sales rulebook (agent system prompt).

Return ONLY valid JSON with this exact shape:
{
  "overallScore": number,
  "grade": "Strong" | "Needs coaching" | "Off-script",
  "rubric": [
    { "rule": string, "weight": number, "passed": boolean, "evidence": string | null }
  ],
  "covered": [{ "text": string, "rule": string | null }],
  "missed": [{ "text": string, "rule": string, "why": string }],
  "issues": [{ "text": string, "rule": string | null, "severity": "blocker" | "warning" | "nit" }],
  "nextSteps": string[]
}

Instructions:
- Derive rubric items from the agent rules (5-12 checkable beats with weights summing ~100).
- Score how well this company's scraped website/profile fits the playbook (ICP fit, messaging angles, gaps).
- Use scrape evidence for every covered/missed/issue line when possible.
- Be concise: max 8 items per list.
- Grade "Strong" = good fit / clear outreach angles; "Needs coaching" = partial fit; "Off-script" = poor fit or missing critical signals.

Agent rules (system prompt):
---
${rules.slice(0, 12000)}
---

Website scrape / company intel:
---
${scrape.slice(0, 20000)}
---`

  const result = await generateReply({
    userMessage,
    history: [],
    systemPrompt:
      'You evaluate scraped company intel against sales playbook rules. Reply with JSON only, no markdown.',
    apiKey: options.apiKey,
    llmModel: options.llmModel,
    accountUserId: options.accountUserId,
    usageSurface: 'leads',
  })

  if (!result.ok) {
    throw new Error(result.error)
  }

  const parsed = parseJsonObject(result.text) || {}
  return normalizeParsedScore(parsed, 'summary')
}

export async function scoreSummaryVsAgent(options: {
  summary: string
  transcript?: string | null
  systemPrompt: string
  apiKey?: string | null
  llmModel?: string | null
  source?: 'summary' | 'transcript'
  accountUserId?: string | null
}): Promise<ScriptScoreResult> {
  const summary = options.summary.trim()
  const transcript = options.transcript?.trim() || ''
  const rules = options.systemPrompt.trim()
  const source = options.source || (transcript ? 'transcript' : 'summary')

  if (!summary && !transcript) {
    throw new Error('No meeting summary or transcript available to score.')
  }
  if (!rules) {
    throw new Error(
      'Selected agent has an empty system prompt. Add rules on /ai-agents, then re-score.',
    )
  }
  if (!options.apiKey?.trim()) {
    throw new Error(
      'Gemini API key missing. Add it in Config Agent (/ai-agents/config).',
    )
  }

  const contextBlock = [
    summary
      ? `Fathom meeting summary:\n---\n${summary.slice(0, 8000)}\n---`
      : null,
    transcript
      ? `Full call transcript (preferred for evidence):\n---\n${transcript.slice(0, 40000)}\n---`
      : null,
  ]
    .filter(Boolean)
    .join('\n\n')

  const userMessage = `You are scoring a sales call against a rulebook (agent system prompt).

Return ONLY valid JSON with this exact shape:
{
  "overallScore": number,
  "grade": "Strong" | "Needs coaching" | "Off-script",
  "rubric": [
    { "rule": string, "weight": number, "passed": boolean, "evidence": string | null }
  ],
  "covered": [{ "text": string, "rule": string | null }],
  "missed": [{ "text": string, "rule": string, "why": string }],
  "issues": [{ "text": string, "rule": string | null, "severity": "blocker" | "warning" | "nit" }],
  "nextSteps": string[]
}

Instructions:
- Derive rubric items from the agent rules (5-12 checkable beats with weights summing ~100).
- Tie every covered/missed/issue line to a specific rule phrase from the rulebook when possible.
- Use transcript evidence when available; fall back to summary only if needed.
- Be concise: max 8 items per list.

Agent rules (system prompt):
---
${rules.slice(0, 12000)}
---

${contextBlock}`

  const result = await generateReply({
    userMessage,
    history: [],
    systemPrompt:
      'You evaluate sales calls against script rules. Reply with JSON only, no markdown.',
    apiKey: options.apiKey,
    llmModel: options.llmModel,
    accountUserId: options.accountUserId,
    usageSurface: 'leads',
  })

  if (!result.ok) {
    throw new Error(result.error)
  }

  const parsed = parseJsonObject(result.text) || {}
  return normalizeParsedScore(parsed, source)
}

async function loadMeetingTranscript(
  userId: string,
  fathomRecordingId: string,
): Promise<string | null> {
  const conn = await prismaClient.callIntelConnection.findUnique({
    where: { userId_provider: { userId, provider: 'FATHOM' } },
  })
  if (!conn?.credentials || conn.status !== 'ACTIVE') return null

  const apiKey = decryptToken(
    (conn.credentials as { apiKey?: string }).apiKey,
  )
  if (!apiKey) return null

  try {
    const remote = await getFathomMeeting(apiKey, fathomRecordingId, {
      include_transcript: true,
    })
    const text = formatFathomTranscript(remote.transcript)
    return text || null
  } catch (err) {
    console.warn('Transcript fetch failed during scoring', err)
    return null
  }
}

export async function scoreMeetingAndSave(options: {
  meetingId: string
  agentId: string
  apiKey?: string | null
  deepScore?: boolean
}) {
  const meeting = await prismaClient.callIntelMeeting.findUnique({
    where: { id: options.meetingId },
    select: {
      id: true,
      summary: true,
      userId: true,
      fathomRecordingId: true,
    },
  })
  if (!meeting) throw new Error('Meeting not found')

  const agent = await prismaClient.liveKitAgent.findUnique({
    where: { id: options.agentId },
    select: { id: true, systemPrompt: true, llmModel: true },
  })
  if (!agent) throw new Error('Agent not found')

  const apiKey =
    options.apiKey?.trim() ||
    (await resolveUserGeminiApiKey(meeting.userId))
  if (!apiKey) {
    throw new Error(
      'Gemini API key missing. Add it in Config Agent (/ai-agents/config).',
    )
  }

  const summary = cleanFathomSummaryText(meeting.summary || '')
  let transcript: string | null = null
  let source: 'summary' | 'transcript' = 'summary'

  if (options.deepScore) {
    transcript = await loadMeetingTranscript(
      meeting.userId,
      meeting.fathomRecordingId,
    )
    if (transcript) source = 'transcript'
  }

  const score = await scoreSummaryVsAgent({
    summary,
    transcript,
    systemPrompt: agent.systemPrompt || '',
    apiKey,
    llmModel: agent.llmModel,
    source,
    accountUserId: meeting.userId,
  })

  const existing = await prismaClient.callIntelScriptScore.findMany({
    where: { meetingId: meeting.id },
    orderBy: { scoredAt: 'desc' },
    select: {
      id: true,
      covered: true,
      missed: true,
      issues: true,
      nextSteps: true,
      rawJson: true,
    },
  })
  const failedIds = existing.filter(isFailedApiScore).map((s) => s.id)
  if (failedIds.length > 0) {
    await prismaClient.callIntelScriptScore.deleteMany({
      where: { id: { in: failedIds } },
    })
  }

  const created = await prismaClient.callIntelScriptScore.create({
    data: {
      meetingId: meeting.id,
      agentId: agent.id,
      covered: score.covered,
      missed: score.missed,
      issues: score.issues,
      nextSteps: score.nextSteps,
      rawJson: score.raw as Prisma.InputJsonValue,
      scoredAt: new Date(),
    },
  })

  const allIds = await prismaClient.callIntelScriptScore.findMany({
    where: { meetingId: meeting.id },
    orderBy: { scoredAt: 'desc' },
    select: { id: true },
  })
  const stale = allIds.slice(MAX_SCORE_HISTORY).map((s) => s.id)
  if (stale.length > 0) {
    await prismaClient.callIntelScriptScore.deleteMany({
      where: { id: { in: stale } },
    })
  }

  return created
}
