'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Check, EyeOff, Plus, RefreshCw, Undo2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { answerQuestionGroup, refreshQuestionsNow, setQuestionGroupHidden } from '@/actions/questions'
import type { QuestionGroupView } from '@/lib/questions/questionGroups'
import { guardAction } from '@/lib/clientActionErrors'
import { cn } from '@/lib/utils'

type Props = {
  groups: QuestionGroupView[]
  /** General questions offer "Make it a new project"; a project's own do not. */
  general: boolean
}

const STATUS_LABEL: Record<QuestionGroupView['status'], string> = {
  OPEN: 'Not answered',
  ANSWERED: 'Answered',
  IGNORED: 'Hidden',
}

/**
 * Questions customers asked, grouped by meaning. The creator answers a group once and every
 * agent (chat, voice, tour) can use that answer from then on.
 */
export function QuestionGroupsView({ groups, general }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [showHidden, setShowHidden] = useState(false)
  const visible = groups.filter((group) => showHidden || group.status !== 'IGNORED')
  const hiddenCount = groups.length - groups.filter((group) => group.status !== 'IGNORED').length
  const open = groups.filter((group) => group.status === 'OPEN' && group.askedCount > 0).length

  const run = (action: () => ReturnType<typeof refreshQuestionsNow>, fallback: string) =>
    startTransition(
      guardAction(async () => {
        const result = await action()
        if (result.ok) {
          toast.success(result.message ?? fallback)
          router.refresh()
        } else toast.error(result.error)
      }),
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {groups.length === 0
            ? 'No questions yet. They appear after customers chat with your AI, and are grouped every Monday.'
            : `${open} not answered yet. Answer once and your chat, voice and tour assistants use it.`}
        </p>
        <div className="flex items-center gap-2">
          {hiddenCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setShowHidden((value) => !value)}>
              {showHidden ? 'Hide hidden' : `Show hidden (${hiddenCount})`}
            </Button>
          ) : null}
          <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => refreshQuestionsNow(), 'Questions updated')}>
            <RefreshCw className={cn('mr-1.5 h-4 w-4', pending && 'animate-spin')} aria-hidden />
            Group questions now
          </Button>
        </div>
      </div>

      <ul className="space-y-3">
        {visible.map((group) => (
          <QuestionGroupCard key={group.id} group={group} general={general} pending={pending} run={run} />
        ))}
      </ul>
    </div>
  )
}

function QuestionGroupCard({
  group,
  general,
  pending,
  run,
}: {
  group: QuestionGroupView
  general: boolean
  pending: boolean
  run: (action: () => ReturnType<typeof refreshQuestionsNow>, fallback: string) => void
}) {
  const [editing, setEditing] = useState(group.status !== 'ANSWERED')
  const [answer, setAnswer] = useState(group.answer ?? '')
  const newProjectHref = `/projects?new=1&title=${encodeURIComponent(group.label)}`

  return (
    <li className={cn('space-y-3 rounded-xl border bg-card p-4', group.status === 'IGNORED' && 'opacity-60')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h3 className="text-pretty font-medium">{group.label}</h3>
          <p className="text-xs text-muted-foreground">
            Asked {group.askedCount} {group.askedCount === 1 ? 'time' : 'times'}
            {group.wentQuietCount > 0 ? ` · ${group.wentQuietCount} went quiet after the answer` : ''}
          </p>
        </div>
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-[11px] font-medium',
            group.status === 'ANSWERED'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'text-muted-foreground',
          )}
        >
          {STATUS_LABEL[group.status]}
        </span>
      </div>

      {group.examples.length > 0 ? (
        <ul className="space-y-1 border-l-2 pl-3 text-sm text-muted-foreground">
          {group.examples.map((example) => (
            <li key={example}>“{example}”</li>
          ))}
        </ul>
      ) : null}

      {editing ? (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (!answer.trim()) {
              toast.error('Write an answer first.')
              return
            }
            run(() => answerQuestionGroup({ id: group.id, answer }), 'Answer saved. Your assistants will use it.')
            setEditing(false)
          }}
        >
          <Textarea
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Your answer, the way you would say it to a customer"
            rows={3}
            maxLength={2000}
            aria-label={`Answer to ${group.label}`}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" type="submit" disabled={pending}>
              <Check className="mr-1.5 h-4 w-4" aria-hidden />
              Save answer
            </Button>
            {group.status === 'ANSWERED' ? (
              <Button size="sm" type="button" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="space-y-2">
          <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm">{group.answer}</p>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit answer
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t pt-3">
        {group.status === 'IGNORED' ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setQuestionGroupHidden({ id: group.id, hidden: false }), 'Shown again')}>
            <Undo2 className="mr-1.5 h-4 w-4" aria-hidden />
            Show again
          </Button>
        ) : (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setQuestionGroupHidden({ id: group.id, hidden: true }), 'Hidden')}>
            <EyeOff className="mr-1.5 h-4 w-4" aria-hidden />
            Hide
          </Button>
        )}
        {general ? (
          <Button size="sm" variant="ghost" asChild>
            <Link href={newProjectHref}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              Make it a new project
            </Link>
          </Button>
        ) : null}
      </div>
    </li>
  )
}
