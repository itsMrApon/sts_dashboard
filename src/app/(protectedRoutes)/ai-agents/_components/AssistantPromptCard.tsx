'use client'
import { updateLiveKitAgent } from '@/actions/livekitAgent'
import type { AgentEngineView } from '@/actions/agentEngine'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertTriangle,
  ArrowUpRight,
  AudioLines,
  Cpu,
  Info,
  Languages,
  Loader2,
  RotateCcw,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { AGENT_LANGUAGES, describeEngine, isAgentLanguage, type AgentLanguage } from '@/lib/agents/engineOptions'
import { estimateTokens, lintAgentText, outlinePrompt } from '@/lib/agents/promptLint'
import { AgentAiEditor } from './AgentAiEditor'

type BehaviorForm = { firstMessage: string; systemPrompt: string; language: AgentLanguage }

/** Scrolls a textarea so the given character offset sits near the top (wrap-aware via a mirror element). */
function scrollTextareaTo(textarea: HTMLTextAreaElement, offset: number) {
  const style = window.getComputedStyle(textarea)
  const mirror = document.createElement('div')
  for (const property of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth', 'boxSizing'] as const) {
    mirror.style[property] = style[property]
  }
  mirror.style.width = `${textarea.clientWidth}px`
  mirror.style.position = 'absolute'
  mirror.style.visibility = 'hidden'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.overflowWrap = 'break-word'
  mirror.textContent = textarea.value.slice(0, offset)
  document.body.appendChild(mirror)
  const top = mirror.scrollHeight
  mirror.remove()
  textarea.focus({ preventScroll: true })
  textarea.setSelectionRange(offset, offset)
  textarea.scrollTop = Math.max(0, top - parseFloat(style.paddingTop || '0') - 4)
}

function FieldLabel({ children, hint, htmlFor }: { children: React.ReactNode; hint: string; htmlFor?: string }) {
  return (
    <div className="mb-2 flex items-center gap-1.5">
      <label htmlFor={htmlFor} className="font-medium">
        {children}
      </label>
      <span title={hint} aria-label={hint}>
        <Info className="h-3.5 w-3.5 text-neutral-500" />
      </span>
    </div>
  )
}

function EngineStrip({ engineView }: { engineView: AgentEngineView | null }) {
  if (!engineView) return null
  const summary = describeEngine(engineView.engine, engineView.voiceLabel)
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-2 text-xs">
      <span className="flex min-w-0 items-center gap-1.5 text-neutral-200">
        <Cpu className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
        <span className="truncate">{summary.llm}</span>
        <span className="text-neutral-500">· {summary.llmProvider}</span>
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-neutral-200">
        <AudioLines className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
        <span className="truncate">{summary.voice}</span>
        <span className="text-neutral-500">· {summary.voiceProvider}</span>
      </span>
      <Link
        href="/ai-agents/config#ai-engine"
        className="ml-auto flex items-center gap-1 text-neutral-400 underline-offset-4 hover:text-white hover:underline"
      >
        Shared by all agents · Change engine
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

/** The editable part of an assistant (its row in /ai-agents). */
export type PromptAssistant = {
  id: string
  name: string
  firstMessage: string
  systemPrompt: string
  language: string
}

/**
 * An assistant's prompt, first line and language: who it is and how it starts. Shared by every
 * service it runs. Text is saved exactly as typed, so Bangla round-trips intact.
 */
export function AssistantPromptCard({
  assistant,
  engineView,
  onDirtyChange,
}: {
  assistant: PromptAssistant
  engineView: AgentEngineView | null
  /** Lets the page warn before switching assistants with unsaved edits. */
  onDirtyChange?: (dirty: boolean) => void
}) {
  const router = useRouter()
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const [saving, setSaving] = useState(false)

  const baseline = useMemo<BehaviorForm>(
    () => ({
      firstMessage: assistant.firstMessage || '',
      systemPrompt: assistant.systemPrompt || '',
      language: isAgentLanguage(assistant.language) ? assistant.language : 'en',
    }),
    [assistant.firstMessage, assistant.systemPrompt, assistant.language],
  )
  const [savedForm, setSavedForm] = useState<BehaviorForm>(baseline)
  const [form, setForm] = useState<BehaviorForm>(baseline)
  useEffect(() => {
    setSavedForm(baseline)
    setForm(baseline)
  }, [baseline])

  const dirty =
    form.firstMessage !== savedForm.firstMessage ||
    form.systemPrompt !== savedForm.systemPrompt ||
    form.language !== savedForm.language

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const issues = useMemo(() => lintAgentText(form), [form])
  const outline = useMemo(() => outlinePrompt(form.systemPrompt), [form.systemPrompt])
  const promptTokens = useMemo(() => estimateTokens(form.systemPrompt), [form.systemPrompt])

  const handleSave = useCallback(async () => {
    if (!dirty || saving) return
    setSaving(true)
    try {
      const res = await updateLiveKitAgent(assistant.id, form)
      if (!res.success || !res.data) {
        toast.error(res.error || 'Failed to save the assistant.')
        return
      }
      // New baseline = what the server stored (Bangla text is kept byte-for-byte).
      setSavedForm({
        firstMessage: res.data.firstMessage || '',
        systemPrompt: res.data.systemPrompt || '',
        language: isAgentLanguage(res.data.language) ? res.data.language : 'en',
      })
      toast.success('Prompt saved. New chats and calls use it.')
      router.refresh()
    } catch (error) {
      console.error('Error updating model configuration:', error)
      toast.error('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [dirty, saving, assistant.id, form, router])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void handleSave()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleSave])

  const setField = <K extends keyof BehaviorForm>(key: K, value: BehaviorForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  return (
    <div className="rounded-2xl border border-border/80 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">Prompt</h2>
          <p className="flex items-center gap-1.5 text-xs text-neutral-400">
            <span
              className={cn('h-1.5 w-1.5 rounded-full', dirty ? 'bg-amber-400' : 'bg-emerald-400')}
              aria-hidden
            />
            {dirty ? 'Unsaved changes' : 'Who it is, how it starts, what it knows · shared by every service it runs'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty ? (
            <Button variant="ghost" size="sm" onClick={() => setForm(baseline)} disabled={saving}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Discard
            </Button>
          ) : null}
          <Button onClick={() => void handleSave()} disabled={!dirty || saving} title="Save (⌘S)">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>

      <div className="space-y-6 p-5">
        <EngineStrip engineView={engineView} />

        <div>
          <FieldLabel hint="Sets speech recognition and the language the agent replies in.">
            <span className="flex items-center gap-1.5">
              <Languages className="h-4 w-4 text-neutral-400" />
              Language
            </span>
          </FieldLabel>
          <div role="radiogroup" aria-label="Agent language" className="inline-flex rounded-lg bg-neutral-950/50 p-1">
            {AGENT_LANGUAGES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={form.language === option.value}
                onClick={() => setField('language', option.value)}
                className={cn(
                  'rounded-md px-4 py-1.5 text-sm transition-colors',
                  form.language === option.value
                    ? 'bg-neutral-700 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200',
                )}
              >
                {option.native}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-end justify-between gap-2">
            <FieldLabel htmlFor="agent-first-message" hint="The first thing the agent says when a call starts.">
              First message
            </FieldLabel>
            <span className="mb-2 text-xs tabular-nums text-neutral-500">{form.firstMessage.length} chars</span>
          </div>
          <Input
            id="agent-first-message"
            value={form.firstMessage}
            onChange={(event) => setField('firstMessage', event.target.value)}
            lang={form.language}
            className="border-input bg-primary/10"
          />
          <div className="mt-2">
            <AgentAiEditor
              compact
              agentId={assistant.id}
              field="firstMessage"
              value={form.firstMessage}
              language={form.language}
              systemPromptContext={form.systemPrompt}
              onApply={(text) => setField('firstMessage', text)}
            />
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <FieldLabel htmlFor="agent-system-prompt" hint="Who the agent is, what it knows, and the rules it follows on every call.">
              System prompt
            </FieldLabel>
            {outline.length > 1 ? (
              <div className="mb-2 flex flex-wrap gap-1" aria-label="Jump to section">
                {outline.map((item) => (
                  <button
                    key={`${item.offset}-${item.label}`}
                    type="button"
                    onClick={() => promptRef.current && scrollTextareaTo(promptRef.current, item.offset)}
                    className="rounded-md bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-400 hover:bg-neutral-700 hover:text-neutral-100"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <Textarea
            id="agent-system-prompt"
            ref={promptRef}
            value={form.systemPrompt}
            onChange={(event) => setField('systemPrompt', event.target.value)}
            lang={form.language}
            className="h-[260px] resize-y border-input bg-primary/10 md:h-[320px] lg:h-[380px]"
          />
          <div className="mt-1.5 flex justify-end gap-3 text-xs tabular-nums text-neutral-500">
            <span>≈ {promptTokens.toLocaleString()} tokens</span>
            <span>{form.systemPrompt.length.toLocaleString()} chars</span>
          </div>
          <div className="mt-2">
            <AgentAiEditor
              agentId={assistant.id}
              field="systemPrompt"
              value={form.systemPrompt}
              language={form.language}
              onApply={(text) => setField('systemPrompt', text)}
            />
          </div>
        </div>

        {issues.length > 0 ? (
          <ul className="space-y-1.5 rounded-lg border border-white/10 bg-neutral-950/40 p-3" aria-label="Checks">
            {issues.map((issue) => (
              <li key={issue.message} className="flex items-start gap-2 text-xs">
                {issue.level === 'warn' ? (
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                ) : (
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-500" />
                )}
                <span className={issue.level === 'warn' ? 'text-neutral-200' : 'text-neutral-400'}>
                  {issue.message}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}

