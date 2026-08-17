export type IssueSeverity = 'blocker' | 'warning' | 'nit'

export type ScoreLineItem = {
  text: string
  rule: string | null
  why: string | null
}

export type ScoreIssueItem = {
  text: string
  rule: string | null
  severity: IssueSeverity
}

export type RubricItem = {
  rule: string
  weight: number
  passed: boolean
  evidence: string | null
}

export type ScoreGrade = 'Strong' | 'Needs coaching' | 'Off-script'

export type MeetingScoreDetail = {
  id: string
  agentId: string
  agentName: string | null
  scoredAt: string
  source: 'summary' | 'transcript'
  overallScore: number
  grade: ScoreGrade
  covered: string[]
  missed: string[]
  issues: string[]
  nextSteps: string[]
  coveredItems: ScoreLineItem[]
  missedItems: ScoreLineItem[]
  issueItems: ScoreIssueItem[]
  rubric: RubricItem[]
}

function asObjectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (v): v is Record<string, unknown> =>
      Boolean(v) && typeof v === 'object' && !Array.isArray(v),
  )
}

function pickString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function normalizeSeverity(value: unknown): IssueSeverity {
  if (value === 'blocker' || value === 'warning' || value === 'nit') {
    return value
  }
  return 'warning'
}

function normalizeGrade(value: unknown, score: number): ScoreGrade {
  if (value === 'Strong' || value === 'Needs coaching' || value === 'Off-script') {
    return value
  }
  if (score >= 75) return 'Strong'
  if (score >= 50) return 'Needs coaching'
  return 'Off-script'
}

export function parseScoreLineItems(
  value: unknown,
  fallback: string[],
): ScoreLineItem[] {
  const objects = asObjectArray(value)
  if (objects.length > 0) {
    return objects
      .map((obj) => ({
        text:
          pickString(obj, 'text') ||
          pickString(obj, 'item') ||
          pickString(obj, 'description') ||
          '',
        rule: pickString(obj, 'rule'),
        why: pickString(obj, 'why') || pickString(obj, 'reason'),
      }))
      .filter((item) => item.text)
      .slice(0, 20)
  }
  return fallback.map((text) => ({ text, rule: null, why: null }))
}

export function parseIssueItems(
  value: unknown,
  fallback: string[],
): ScoreIssueItem[] {
  const objects = asObjectArray(value)
  if (objects.length > 0) {
    return objects
      .map((obj) => ({
        text:
          pickString(obj, 'text') ||
          pickString(obj, 'item') ||
          pickString(obj, 'description') ||
          '',
        rule: pickString(obj, 'rule'),
        severity: normalizeSeverity(obj.severity),
      }))
      .filter((item) => item.text)
      .slice(0, 20)
  }
  return fallback.map((text) => ({
    text,
    rule: null,
    severity: 'warning' as const,
  }))
}

export function parseRubric(value: unknown): RubricItem[] {
  return asObjectArray(value)
    .map((obj) => ({
      rule: pickString(obj, 'rule') || pickString(obj, 'name') || '',
      weight:
        typeof obj.weight === 'number' && obj.weight > 0
          ? Math.round(obj.weight)
          : 1,
      passed: obj.passed === true,
      evidence: pickString(obj, 'evidence'),
    }))
    .filter((item) => item.rule)
    .slice(0, 30)
}

export function computeOverallScore(options: {
  covered: string[]
  missed: string[]
  issues: string[]
  rubric: RubricItem[]
  rawScore?: unknown
}): number {
  if (typeof options.rawScore === 'number' && !Number.isNaN(options.rawScore)) {
    return Math.max(0, Math.min(100, Math.round(options.rawScore)))
  }

  if (options.rubric.length > 0) {
    const totalWeight = options.rubric.reduce((sum, r) => sum + r.weight, 0)
    if (totalWeight > 0) {
      const earned = options.rubric
        .filter((r) => r.passed)
        .reduce((sum, r) => sum + r.weight, 0)
      return Math.round((earned / totalWeight) * 100)
    }
  }

  const covered = options.covered.length
  const missed = options.missed.length
  const issues = options.issues.length
  const denom = covered + missed + issues
  if (denom === 0) return 0

  const base = (covered / denom) * 100
  const penalty = Math.min(issues * 5, 25)
  return Math.max(0, Math.min(100, Math.round(base - penalty)))
}

export function buildMeetingScoreDetail(input: {
  id: string
  agentId: string
  agentName: string | null
  scoredAt: Date
  covered: string[]
  missed: string[]
  issues: string[]
  nextSteps: string[]
  rawJson?: unknown
}): MeetingScoreDetail {
  const raw =
    input.rawJson && typeof input.rawJson === 'object'
      ? (input.rawJson as Record<string, unknown>)
      : {}

  const rubric = parseRubric(raw.rubric)
  const coveredItems = parseScoreLineItems(raw.coveredItems ?? raw.covered, input.covered)
  const missedItems = parseScoreLineItems(raw.missedItems ?? raw.missed, input.missed)
  const issueItems = parseIssueItems(raw.issueItems ?? raw.issues, input.issues)

  const overallScore = computeOverallScore({
    covered: input.covered,
    missed: input.missed,
    issues: input.issues,
    rubric,
    rawScore: raw.overallScore,
  })

  return {
    id: input.id,
    agentId: input.agentId,
    agentName: input.agentName,
    scoredAt: input.scoredAt.toISOString(),
    source: raw.source === 'transcript' ? 'transcript' : 'summary',
    overallScore,
    grade: normalizeGrade(raw.grade, overallScore),
    covered: input.covered,
    missed: input.missed,
    issues: input.issues,
    nextSteps: input.nextSteps,
    coveredItems,
    missedItems,
    issueItems,
    rubric,
  }
}

export function buildCoachingNote(score: MeetingScoreDetail): string {
  const lines = [
    `Score: ${score.overallScore}/100 (${score.grade})`,
    score.agentName ? `Agent: ${score.agentName}` : null,
    '',
    score.missedItems.length > 0 ? 'Missed:' : null,
    ...score.missedItems.map((item) => {
      const rule = item.rule ? ` [${item.rule}]` : ''
      const why = item.why ? ` — ${item.why}` : ''
      return `- ${item.text}${rule}${why}`
    }),
    '',
    score.nextSteps.length > 0 ? 'Next steps:' : null,
    ...score.nextSteps.map((step) => `- ${step}`),
  ].filter(Boolean) as string[]

  return lines.join('\n')
}
