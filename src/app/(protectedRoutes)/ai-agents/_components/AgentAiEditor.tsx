'use client'

import { useMemo, useState, useTransition } from 'react'
import { ArrowUp, Check, Loader2, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { editLiveKitAgentTextWithAi } from '@/actions/livekitAgent'
import { Button } from '@/components/ui/button'
import {
  AGENT_AI_QUICK_ACTIONS,
  AI_INSTRUCTION_MAX,
  type AgentAiField,
  type AgentAiQuickAction,
} from '@/lib/agents/agentAiActions'
import type { AgentLanguage } from '@/lib/agents/engineOptions'
import { diffTokens, keptRatio, tokenizeLines, tokenizeWords, type DiffSegment } from '@/lib/text/textDiff'
import { cn } from '@/lib/utils'

type Proposal = { text: string; base: string; label: string; usedCalls: number }

const INLINE_DIFF_MIN_KEPT = 0.4

/** For rewrites/translations that replace most of the text: plain before → after blocks. */
function BeforeAfterView({ before, after, mode }: { before: string; after: string; mode: 'lines' | 'words' }) {
  const box = cn(
    'overflow-auto rounded-md p-3 text-sm leading-relaxed whitespace-pre-wrap break-words',
    mode === 'lines' ? 'max-h-60 font-mono text-[13px]' : 'max-h-32',
  )
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <div>
        <p className="mb-1 text-[11px] uppercase tracking-wide text-neutral-500">Before</p>
        <div className={cn(box, 'bg-neutral-950/70 text-neutral-500')}>{before || '(empty)'}</div>
      </div>
      <div>
        <p className="mb-1 text-[11px] uppercase tracking-wide text-emerald-400/80">After</p>
        <div className={cn(box, 'bg-emerald-500/10 text-neutral-100')}>{after}</div>
      </div>
    </div>
  )
}

function DiffView({ segments, mode }: { segments: DiffSegment[]; mode: 'lines' | 'words' }) {
  return (
    <div
      className={cn(
        'overflow-auto rounded-md bg-neutral-950/70 p-3 text-sm leading-relaxed whitespace-pre-wrap break-words',
        mode === 'lines' ? 'max-h-80 font-mono text-[13px]' : 'max-h-40',
      )}
    >
      {segments.map((segment, index) => (
        <span
          key={index}
          className={cn(
            segment.kind === 'added' && 'rounded-sm bg-emerald-500/15 text-emerald-300',
            segment.kind === 'removed' && 'rounded-sm bg-red-500/10 text-red-300/80 line-through decoration-red-400/60',
            segment.kind === 'same' && 'text-neutral-400',
          )}
        >
          {segment.text}
        </span>
      ))}
    </div>
  )
}

/**
 * "Edit with AI" for one agent text field. Generates a proposal on the server, shows it as a diff,
 * and only touches the field when the creator accepts (they still Save the agent afterwards).
 */
export function AgentAiEditor({
  agentId,
  field,
  value,
  language,
  systemPromptContext,
  onApply,
  compact = false,
}: {
  agentId: string
  field: AgentAiField
  value: string
  language: AgentLanguage
  systemPromptContext?: string
  onApply: (text: string) => void
  compact?: boolean
}) {
  const [instruction, setInstruction] = useState('')
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [runningAction, setRunningAction] = useState<AgentAiQuickAction | 'custom' | null>(null)
  const [isGenerating, startGenerating] = useTransition()

  const quickActions = AGENT_AI_QUICK_ACTIONS.filter((action) => action.fields.includes(field))
  const diffMode = field === 'systemPrompt' ? 'lines' : 'words'

  const segments = useMemo(() => {
    if (!proposal) return []
    const tokenize = diffMode === 'lines' ? tokenizeLines : tokenizeWords
    return diffTokens(tokenize(proposal.base), tokenize(proposal.text))
  }, [proposal, diffMode])
  const unchanged = proposal !== null && proposal.text === proposal.base
  const mostlyRewritten = proposal !== null && keptRatio(segments, proposal.base) < INLINE_DIFF_MIN_KEPT

  const generate = (quickAction: AgentAiQuickAction | null) => {
    const trimmed = instruction.trim()
    if (!quickAction && !trimmed) {
      toast.error('Describe the change, or pick a quick action.')
      return
    }
    const base = value
    const label = quickAction
      ? (quickActions.find((action) => action.id === quickAction)?.label ?? 'AI edit')
      : trimmed
    setRunningAction(quickAction ?? 'custom')
    startGenerating(async () => {
      const result = await editLiveKitAgentTextWithAi({
        agentId,
        field,
        quickAction,
        instruction: trimmed,
        currentText: base,
        systemPromptContext,
        language,
      })
      setRunningAction(null)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setProposal({ text: result.text, base, label, usedCalls: result.usedCalls })
    })
  }

  const accept = () => {
    if (!proposal) return
    if (value !== proposal.base) {
      const replace = window.confirm('You edited the text after asking the AI. Replace it with the AI version anyway?')
      if (!replace) return
    }
    const previous = value
    onApply(proposal.text)
    setProposal(null)
    setInstruction('')
    toast.success('AI edit applied — Save changes to make it live.', {
      action: { label: 'Undo', onClick: () => onApply(previous) },
    })
  }

  return (
    <div className={cn('rounded-lg border border-white/10 bg-neutral-950/40', compact ? 'p-2.5' : 'p-3')}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 flex items-center gap-1.5 text-xs font-medium text-neutral-300">
          <Sparkles className="h-3.5 w-3.5 text-violet-300" />
          Edit with AI
        </span>
        {quickActions.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled={isGenerating}
            onClick={() => generate(action.id)}
            className={cn(
              'flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-xs text-neutral-300 transition-colors',
              'hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white disabled:opacity-50',
            )}
          >
            {runningAction === action.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {action.label}
          </button>
        ))}
      </div>

      <form
        className="mt-2 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          generate(null)
        }}
      >
        <input
          value={instruction}
          onChange={(event) => setInstruction(event.target.value.slice(0, AI_INSTRUCTION_MAX))}
          placeholder={
            field === 'systemPrompt'
              ? 'Describe a change… e.g. "add our refund policy and ask for the caller’s name first"'
              : 'Describe a change… e.g. "warmer, mention our free consultation"'
          }
          aria-label={field === 'systemPrompt' ? 'AI instruction for the system prompt' : 'AI instruction for the first message'}
          className="h-9 min-w-0 flex-1 rounded-md border border-white/10 bg-transparent px-3 text-sm outline-none placeholder:text-neutral-500 focus-visible:border-violet-400/50 focus-visible:ring-2 focus-visible:ring-violet-500/20"
        />
        <Button
          type="submit"
          size="icon"
          variant="secondary"
          aria-label="Generate AI edit"
          disabled={isGenerating || !instruction.trim()}
          className="h-9 w-9 shrink-0"
        >
          {runningAction === 'custom' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
        </Button>
      </form>

      {proposal ? (
        <div className="mt-3 space-y-2" role="region" aria-label="AI suggestion">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 text-xs text-neutral-400">
              <span className="font-medium text-neutral-200">AI suggestion</span> · {proposal.label}
              {proposal.usedCalls > 0 ? ` · from ${proposal.usedCalls} recent call${proposal.usedCalls === 1 ? '' : 's'}` : ''}
            </p>
            <div className="flex gap-1.5">
              <Button type="button" size="sm" variant="ghost" onClick={() => setProposal(null)}>
                <X className="mr-1 h-3.5 w-3.5" />
                Discard
              </Button>
              <Button type="button" size="sm" onClick={accept} disabled={unchanged}>
                <Check className="mr-1 h-3.5 w-3.5" />
                Accept
              </Button>
            </div>
          </div>
          {unchanged ? (
            <p className="text-xs text-neutral-500">The AI didn’t change anything. Try a more specific instruction.</p>
          ) : mostlyRewritten ? (
            <BeforeAfterView before={proposal.base} after={proposal.text} mode={diffMode} />
          ) : (
            <DiffView segments={segments} mode={diffMode} />
          )}
        </div>
      ) : null}
    </div>
  )
}
