'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  buildCoachingNote,
  type MeetingScoreDetail,
  type ScoreGrade,
} from '@/lib/leads/scoreTypes'

type MeetingTrend = {
  meetingId: string
  label: string
  score: number | null
}

type Props = {
  score: MeetingScoreDetail
  scoreHistory?: MeetingScoreDetail[]
  meetingTrend?: MeetingTrend[]
  agentName: string | null
  onAddToNotes: (text: string) => void
  onAskAbout: (prompt: string) => void
  onRunScore?: (deep: boolean) => void
  pending?: boolean
  className?: string
}

const GRADE_LABEL: Record<ScoreGrade, string> = {
  Strong: 'On track',
  'Needs coaching': 'Room to improve',
  'Off-script': 'Off playbook',
}

function formatWhen(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function Section({
  title,
  count,
  children,
}: {
  title: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {count != null ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            {count}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function EmptyLine() {
  return <p className="text-muted-foreground text-sm">Nothing noted.</p>
}

export function ScoreResultPanel({
  score: initialScore,
  scoreHistory = [],
  meetingTrend = [],
  agentName,
  onAddToNotes,
  onAskAbout,
  onRunScore,
  pending,
  className,
}: Props) {
  const allRuns = useMemo(
    () => [initialScore, ...scoreHistory],
    [initialScore, scoreHistory],
  )
  const [selectedRunId, setSelectedRunId] = useState(initialScore.id)
  const score =
    allRuns.find((run) => run.id === selectedRunId) || initialScore

  async function copyCoachingNote() {
    try {
      await navigator.clipboard.writeText(buildCoachingNote(score))
      toast.success('Copied')
    } catch {
      toast.error('Could not copy')
    }
  }

  const trendWithScores = meetingTrend.filter((t) => t.score != null)

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      {/* Summary strip */}
      <div className="shrink-0 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs">Call score</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-4xl font-semibold tracking-tight tabular-nums">
                {score.overallScore}
              </span>
              <span className="text-muted-foreground text-sm">
                {GRADE_LABEL[score.grade]}
              </span>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              {score.source === 'transcript'
                ? 'From full transcript'
                : 'From meeting summary'}
              {' · '}
              {score.agentName || agentName || 'Playbook'}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground h-8 px-2 text-xs"
              onClick={() => void copyCoachingNote()}
            >
              Copy summary
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground h-8 px-2 text-xs"
              onClick={() => {
                onAddToNotes(buildCoachingNote(score))
                toast.success('Added to notes')
              }}
            >
              Save to notes
            </Button>
          </div>
        </div>

        {allRuns.length > 1 ? (
          <Select value={selectedRunId} onValueChange={setSelectedRunId}>
            <SelectTrigger className="mt-4 h-8 max-w-xs border-0 bg-muted/50 text-xs shadow-none">
              <SelectValue placeholder="Earlier review" />
            </SelectTrigger>
            <SelectContent>
              {allRuns.map((run, idx) => (
                <SelectItem key={run.id} value={run.id} className="text-xs">
                  {idx === 0 ? 'Latest' : formatWhen(run.scoredAt)} ·{' '}
                  {run.overallScore}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {trendWithScores.length > 1 ? (
          <p className="text-muted-foreground mt-3 text-xs">
            Past calls{' '}
            {[...trendWithScores].reverse().map((point, i, arr) => (
              <span key={point.meetingId}>
                {point.label} {point.score}
                {i < arr.length - 1 ? ' → ' : ''}
              </span>
            ))}
          </p>
        ) : null}
      </div>

      <Separator className="shrink-0" />

      {/* Scrollable body */}
      <div className="min-h-0 flex-1 space-y-8 overflow-y-auto py-6">
        {score.rubric.length > 0 ? (
          <Section title="Playbook checklist" count={score.rubric.length}>
            <ul className="space-y-2">
              {score.rubric.map((item) => (
                <li
                  key={item.rule}
                  className="flex gap-3 text-sm leading-snug"
                >
                  <span
                    className={cn(
                      'mt-1.5 size-1.5 shrink-0 rounded-full',
                      item.passed ? 'bg-foreground/70' : 'bg-foreground/20',
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className={cn(!item.passed && 'text-muted-foreground')}>
                      {item.rule}
                    </p>
                    {item.evidence ? (
                      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                        {item.evidence}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section title="What went well" count={score.coveredItems.length}>
          {score.coveredItems.length === 0 ? (
            <EmptyLine />
          ) : (
            <ul className="space-y-3">
              {score.coveredItems.map((item) => (
                <li key={`${item.text}-${item.rule}`} className="text-sm">
                  <p className="leading-snug">{item.text}</p>
                  {item.rule ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {item.rule}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Missed" count={score.missedItems.length}>
          {score.missedItems.length === 0 ? (
            <EmptyLine />
          ) : (
            <ul className="space-y-4">
              {score.missedItems.map((item) => (
                <li key={`${item.text}-${item.rule}`} className="text-sm">
                  <p className="leading-snug">{item.text}</p>
                  {item.rule ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {item.rule}
                    </p>
                  ) : null}
                  {item.why ? (
                    <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                      {item.why}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground mt-2 text-xs underline-offset-4 hover:underline"
                    onClick={() =>
                      onAskAbout(
                        `Where in this call did we miss "${item.rule || item.text}"? ${item.why || ''}`.trim(),
                      )
                    }
                  >
                    Ask about this in chat
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {score.issueItems.length > 0 ? (
          <Section title="Flags" count={score.issueItems.length}>
            <ul className="space-y-3">
              {score.issueItems.map((item) => (
                <li key={`${item.text}-${item.severity}`} className="text-sm">
                  <p className="leading-snug">
                    {item.severity !== 'warning' ? (
                      <span className="text-muted-foreground mr-1.5 text-xs uppercase">
                        {item.severity}
                      </span>
                    ) : null}
                    {item.text}
                  </p>
                  {item.rule ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {item.rule}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section title="Follow-up" count={score.nextSteps.length}>
          {score.nextSteps.length === 0 ? (
            <EmptyLine />
          ) : (
            <ul className="space-y-2">
              {score.nextSteps.map((step) => (
                <li
                  key={step}
                  className="text-muted-foreground text-sm leading-snug"
                >
                  {step}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Separator className="shrink-0" />

      <div className="text-muted-foreground flex shrink-0 flex-wrap items-center justify-between gap-3 pt-3 text-xs">
        <span>Reviewed {formatWhen(score.scoredAt)}</span>
        {onRunScore ? (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              disabled={pending}
              onClick={() => onRunScore(false)}
            >
              Run again
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              disabled={pending}
              onClick={() => onRunScore(true)}
            >
              Review with transcript
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function ScoreEmptyState({
  agentName,
  hasGeminiKey,
  hasMeeting,
  pending,
  onRunScore,
  noMeetingMessage,
}: {
  agentName: string | null
  hasGeminiKey: boolean
  hasMeeting: boolean
  pending?: boolean
  onRunScore: (deep: boolean) => void
  noMeetingMessage?: string
}) {
  if (!hasMeeting) {
    return (
      <p className="text-muted-foreground py-8 text-sm">
        {noMeetingMessage ||
          'Sync a Fathom recording first, then you can review the call here.'}
      </p>
    )
  }

  if (!hasGeminiKey) {
    return (
      <div className="space-y-3 py-8">
        <p className="text-muted-foreground text-sm">
          Add a Gemini key in Config Agent to review calls against your
          playbook.
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/ai-agents/config">Config Agent</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 py-8">
      <div className="space-y-1">
        <p className="text-sm font-medium">Review this call</p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {agentName
            ? `We’ll compare the conversation to “${agentName}”.`
            : 'Pick a playbook on the lead profile first.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !agentName}
          onClick={() => onRunScore(false)}
        >
          Review from summary
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending || !agentName}
          onClick={() => onRunScore(true)}
        >
          Review with transcript
        </Button>
      </div>
    </div>
  )
}
