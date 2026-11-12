import 'server-only'
import { prismaClient } from '@/lib/prismaClient'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'
import { generateReply } from '@/lib/messages/geminiText'
import { decryptToken } from '@/lib/messages/encrypt'
import { getUserVoiceCredentialByUserId } from '@/lib/voiceCredentialsRepo'
import { loadBusinessFacts } from '@/lib/wizard/draftSteps'
import type { AgentLanguage } from '@/lib/agents/engineOptions'
import type { AgentAiField, AgentAiQuickAction } from '@/lib/agents/agentAiActions'

const AI_EDIT_TIMEOUT_MS = 30_000
const TRANSCRIPT_LIMIT = 5
const TRANSCRIPT_CHARS_PER_CALL = 1_500

export type AgentTextEditInput = {
  userId: string
  roomName: string
  agentName: string
  field: AgentAiField
  quickAction: AgentAiQuickAction | null
  instruction: string
  currentText: string
  /** The draft system prompt, for context when editing the first message. */
  systemPromptContext: string
  language: AgentLanguage
}

export type AgentTextEditResult =
  | { ok: true; text: string; usedCalls: number }
  | { ok: false; error: string }

const QUICK_ACTION_BRIEFS: Record<AgentAiQuickAction, string> = {
  improve:
    'Improve clarity and structure. Keep every fact, rule and intent. Organize into short labelled sections (Role, Goals, Tone, Knowledge, Guardrails, Handoff) when that helps.',
  shorten:
    'Make it noticeably shorter for a latency-sensitive voice agent. Remove repetition and filler; keep every rule and fact that changes behavior.',
  guardrails:
    'Add or tighten guardrails: never invent prices, policies or facts; say so when unsure; stay on topic; protect caller privacy; escalate to a human when asked or when the caller is upset.',
  voice:
    'Optimize for spoken conversation: short sentences, one question at a time, no markdown/lists/emojis in replies, natural turn-taking, how to handle interruptions and silence.',
  bangla:
    'Rewrite so the agent speaks natural, polite Bangla (bn-BD, Bengali script). Keep brand and product names as written. Instructions may stay in English but must clearly require Bangla replies.',
  fromCalls:
    'Use the recent call transcripts to find where the agent struggled (missed questions, objections, confusion, wrong language) and change the text so it handles those cases. Do not copy caller personal details.',
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | 'TIMEOUT'> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve('TIMEOUT'), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/** Models sometimes wrap output in a code fence or add a preface line; strip only those. */
function cleanModelText(raw: string): string {
  let text = raw.replace(/^﻿/u, '')
  const fenced = text.match(/^\s*```[a-zA-Z-]*\n([\s\S]*?)\n```\s*$/u)
  if (fenced) text = fenced[1]
  return text.replace(/^\s*(here(?:'s| is) (?:the )?(?:revised|updated|improved)[^\n]*:\s*\n)/iu, '').trim()
}

type TranscriptLine = { role?: string; text?: string }

async function loadRecentCalls(userId: string, roomName: string): Promise<string[]> {
  const calls = await prismaClient.callTranscript.findMany({
    where: { userId, roomName: { startsWith: roomName } },
    orderBy: { createdAt: 'desc' },
    take: TRANSCRIPT_LIMIT,
    select: { transcript: true, outcome: true, summary: true },
  })
  return calls.map((call, index) => {
    const lines = Array.isArray(call.transcript) ? (call.transcript as TranscriptLine[]) : []
    const dialogue = lines
      .filter((line) => typeof line?.text === 'string' && line.text.trim())
      .map((line) => `${line.role === 'agent' ? 'Agent' : 'Caller'}: ${line.text}`)
      .join('\n')
      .slice(0, TRANSCRIPT_CHARS_PER_CALL)
    return [
      `Call ${index + 1}${call.outcome ? ` (outcome: ${call.outcome})` : ''}`,
      call.summary ? `Summary: ${call.summary}` : '',
      dialogue,
    ]
      .filter(Boolean)
      .join('\n')
  })
}

export async function editAgentTextWithAi(input: AgentTextEditInput): Promise<AgentTextEditResult> {
  const business = await getCreatorBusiness(input.userId)
  const [facts, recentCalls, credential] = await Promise.all([
    loadBusinessFacts({ workspaceId: business?.workspaceId ?? null, fallbackName: input.agentName }),
    input.quickAction === 'fromCalls' ? loadRecentCalls(input.userId, input.roomName) : Promise.resolve([]),
    getUserVoiceCredentialByUserId(input.userId).catch(() => null),
  ])

  if (input.quickAction === 'fromCalls' && recentCalls.length === 0) {
    return { ok: false, error: 'No recorded calls for this agent yet. Run a few voice calls first.' }
  }

  let apiKey: string | null = null
  try {
    apiKey = decryptToken(credential?.googleApiKey) || null
  } catch {
    apiKey = null
  }

  const isPrompt = input.field === 'systemPrompt'
  const languageRule =
    input.language === 'bn'
      ? 'The agent talks to callers in Bangla (bn-BD). Any caller-facing wording you write must be natural Bangla in Bengali script; keep brand names as-is. Never transliterate Bangla into Latin letters.'
      : 'The agent talks to callers in English.'

  const systemPrompt = [
    'You are an expert conversation designer who edits configuration text for a real-time voice AI agent.',
    isPrompt
      ? 'You are editing the agent SYSTEM PROMPT. Return the complete revised system prompt.'
      : 'You are editing the FIRST MESSAGE the agent speaks when a call starts. Return one short spoken greeting (max 2 sentences, under 220 characters).',
    languageRule,
    'Use only the business facts provided. Never invent prices, awards, statistics or policies.',
    'Preserve any placeholders like {{name}} or [Company] exactly.',
    'Return ONLY the revised text. No explanations, no preface, no code fences.',
  ].join('\n')

  const brief = [
    input.quickAction ? `Task: ${QUICK_ACTION_BRIEFS[input.quickAction]}` : '',
    input.instruction.trim() ? `Creator instruction: ${input.instruction.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const userMessage = [
    brief,
    '',
    `Business facts: ${JSON.stringify({
      businessName: facts.businessName,
      pitch: facts.pitch,
      description: facts.description,
      offerings: facts.offerings,
      profile: facts.profileSummary,
    })}`,
    !isPrompt && input.systemPromptContext.trim()
      ? `\nAgent system prompt (context only, do not return it):\n${input.systemPromptContext.slice(0, 6_000)}`
      : '',
    recentCalls.length ? `\nRecent calls:\n${recentCalls.join('\n\n')}` : '',
    '',
    `Current ${isPrompt ? 'system prompt' : 'first message'}:`,
    input.currentText.trim() ? input.currentText : '(empty — write one from scratch)',
  ].join('\n')

  const result = await withTimeout(
    generateReply({
      userMessage,
      history: [],
      systemPrompt,
      apiKey,
      accountUserId: input.userId,
      usageSurface: 'app',
    }),
    AI_EDIT_TIMEOUT_MS,
  )
  if (result === 'TIMEOUT') return { ok: false, error: 'The AI took too long. Try again or shorten the prompt.' }
  if (!result.ok) return { ok: false, error: result.error }

  const text = cleanModelText(result.text)
  if (!text) return { ok: false, error: 'The AI returned an empty draft. Try a different instruction.' }
  return { ok: true, text, usedCalls: recentCalls.length }
}
