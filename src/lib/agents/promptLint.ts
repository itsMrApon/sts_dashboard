import type { AgentLanguage } from '@/lib/agents/engineOptions'

/** Client-safe checks for the agent Model section. Heuristics only — they never block saving. */

const BENGALI_CHAR = /[ঀ-৿]/gu
const LATIN_LETTER = /[A-Za-z]/gu
const BANGLA_INSTRUCTION = /bangla|bengali|bn-bd|বাংলা/iu
const GUARDRAIL_HINT = /\b(never|do not|don't|avoid|must not|only use|if unsure)\b|কখনো|করবেন না|করবে না/iu

/** Voice agents pay for the prompt on every turn; past this it noticeably adds latency/cost. */
export const PROMPT_TOKEN_WARN = 3_000

export type PromptIssue = { level: 'warn' | 'info'; message: string }

export type PromptOutlineItem = { label: string; offset: number }

function countMatches(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0
}

/**
 * Rough token estimate: ~4 chars/token for Latin text, ~2 chars/token for Bengali script,
 * which tokenizes less efficiently. Good enough to flag long prompts, not for billing.
 */
export function estimateTokens(text: string): number {
  const bengali = countMatches(text, BENGALI_CHAR)
  const other = text.length - bengali
  return Math.ceil(other / 4 + bengali / 2)
}

export function bengaliShare(text: string): number {
  const bengali = countMatches(text, BENGALI_CHAR)
  const latin = countMatches(text, LATIN_LETTER)
  const letters = bengali + latin
  return letters === 0 ? 0 : bengali / letters
}

export function lintAgentText(input: {
  systemPrompt: string
  firstMessage: string
  language: AgentLanguage
}): PromptIssue[] {
  const issues: PromptIssue[] = []
  const prompt = input.systemPrompt.trim()
  const firstMessage = input.firstMessage.trim()

  if (!prompt) {
    issues.push({ level: 'warn', message: 'System prompt is empty — the agent will fall back to a generic prompt.' })
    return issues
  }

  const tokens = estimateTokens(prompt)
  if (tokens > PROMPT_TOKEN_WARN) {
    issues.push({
      level: 'warn',
      message: `About ${tokens.toLocaleString()} tokens. Long prompts add latency to every voice turn — try "Make shorter".`,
    })
  }

  if (input.language === 'bn') {
    if (!BANGLA_INSTRUCTION.test(prompt) && bengaliShare(prompt) < 0.2) {
      issues.push({
        level: 'warn',
        message: 'Language is Bangla, but the prompt never tells the agent to reply in Bangla.',
      })
    }
    if (firstMessage && bengaliShare(firstMessage) < 0.5) {
      issues.push({ level: 'warn', message: 'Language is Bangla, but the first message is not in Bangla script.' })
    }
  } else if (firstMessage && bengaliShare(firstMessage) > 0.5) {
    issues.push({ level: 'warn', message: 'First message is in Bangla, but the language is set to English.' })
  }

  if (!GUARDRAIL_HINT.test(prompt)) {
    issues.push({
      level: 'info',
      message: 'No guardrails found (e.g. "never invent prices"). Try "Add guardrails".',
    })
  }

  return issues
}

const HEADING_PATTERNS = [
  /^#{1,4}\s+(.+?)\s*#*\s*$/u, // # Markdown heading
  /^\*\*(.+?)\*\*:?\s*$/u, // **Bold heading**
  /^([A-Zঀ-৿][^\n:]{1,40}):\s*$/u, // Title:  (line that only holds a label)
]

/** Section headings in the prompt with their character offset, for jump-to-section chips. */
export function outlinePrompt(text: string): PromptOutlineItem[] {
  const outline: PromptOutlineItem[] = []
  let offset = 0
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    for (const pattern of HEADING_PATTERNS) {
      const match = trimmed.match(pattern)
      if (match) {
        outline.push({ label: match[1].trim().slice(0, 40), offset })
        break
      }
    }
    offset += line.length + 1
  }
  return outline.slice(0, 12)
}
