'use client'
import { updateLiveKitAgent } from '@/actions/livekitAgent'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, ChevronDown, Info, Loader2, RotateCcw, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { AGENT_LANGUAGES, isAgentLanguage, type AgentLanguage } from '@/lib/agents/engineOptions'
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
    <div className="flex items-center gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {children}
      </label>
      <span title={hint} aria-label={hint}>
        <Info className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
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
  onDirtyChange,
}: {
  assistant: PromptAssistant
  /** Lets the page warn before switching assistants with unsaved edits. */
  onDirtyChange?: (dirty: boolean) => void
}) {
  const router = useRouter()
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const [saving, setSaving] = useState(false)
  const [aiOpen, setAiOpen] = useState<{ firstMessage: boolean; systemPrompt: boolean }>({ firstMessage: false, systemPrompt: false })
  const [checksOpen, setChecksOpen] = useState(false)

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

  const warnings = issues.filter((issue) => issue.level === 'warn').length

  const aiToggle = (field: 'firstMessage' | 'systemPrompt', label: string) => (
    <button
      type="button"
      onClick={() => setAiOpen((current) => ({ ...current, [field]: !current[field] }))}
      aria-expanded={aiOpen[field]}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs transition-colors',
        aiOpen[field] ? 'bg-violet-500/15 text-violet-300' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Sparkles className="h-3.5 w-3.5" />
      {label}
    </button>
  )

  return (
    <div className="flex flex-col">
      {/* One slim bar: language on the left, save state on the right. Sticks while the prompt scrolls. */}
      <div id="prompt-language" className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card/90 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div role="radiogroup" aria-label="Agent language" className="inline-flex rounded-lg bg-muted/60 p-0.5">
          {AGENT_LANGUAGES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={form.language === option.value}
              onClick={() => setField('language', option.value)}
              title="Speech recognition and reply language"
              className={cn(
                'rounded-md px-3 py-1 text-sm transition-colors',
                form.language === option.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option.native}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
            <span className={cn('h-1.5 w-1.5 rounded-full', dirty ? 'bg-amber-400' : 'bg-emerald-400')} aria-hidden />
            {dirty ? 'Unsaved changes' : 'Saved'}
          </span>
          {dirty ? (
            <Button variant="ghost" size="sm" onClick={() => setForm(savedForm)} disabled={saving}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Discard
            </Button>
          ) : null}
          <Button size="sm" onClick={() => void handleSave()} disabled={!dirty || saving} title="Save (⌘S)">
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            {saving ? 'Saving…' : 'Save'}
            {!saving ? <kbd className="ml-1.5 hidden font-mono text-[10px] opacity-60 sm:inline">⌘S</kbd> : null}
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-8">
        <section id="prompt-first-message" className="rounded-xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <FieldLabel htmlFor="agent-first-message" hint="The first thing the agent says when a conversation starts.">
              First message
            </FieldLabel>
            {aiToggle('firstMessage', 'Rewrite')}
          </div>
          <Input
            id="agent-first-message"
            value={form.firstMessage}
            onChange={(event) => setField('firstMessage', event.target.value)}
            lang={form.language}
            className="h-11 rounded-xl border-border bg-muted/30 text-[15px] focus-visible:bg-background"
          />
          <p className="mt-1.5 text-right text-xs tabular-nums text-muted-foreground">{form.firstMessage.length} chars</p>
          {aiOpen.firstMessage ? (
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
          ) : null}
        </section>

        <section id="prompt-system" className="rounded-xl">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <FieldLabel htmlFor="agent-system-prompt" hint="Who the agent is, what it knows, and the rules it follows every time.">
              System prompt
            </FieldLabel>
            {aiToggle('systemPrompt', 'Edit with AI')}
          </div>
          {outline.length > 1 ? (
            <div className="mb-2 flex flex-wrap gap-1" aria-label="Jump to section">
              {outline.map((item) => (
                <button
                  key={`${item.offset}-${item.label}`}
                  type="button"
                  onClick={() => promptRef.current && scrollTextareaTo(promptRef.current, item.offset)}
                  className="rounded-md px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  # {item.label}
                </button>
              ))}
            </div>
          ) : null}
          {aiOpen.systemPrompt ? (
            <div className="mb-3">
              <AgentAiEditor
                agentId={assistant.id}
                field="systemPrompt"
                value={form.systemPrompt}
                language={form.language}
                onApply={(text) => setField('systemPrompt', text)}
              />
            </div>
          ) : null}
          <Textarea
            id="agent-system-prompt"
            ref={promptRef}
            value={form.systemPrompt}
            onChange={(event) => setField('systemPrompt', event.target.value)}
            lang={form.language}
            className="h-[300px] resize-y rounded-xl border-border bg-muted/30 p-4 text-[14px] leading-relaxed focus-visible:bg-background md:h-[380px] lg:h-[460px]"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums text-muted-foreground">
            {issues.length > 0 ? (
              <button
                type="button"
                onClick={() => setChecksOpen((open) => !open)}
                aria-expanded={checksOpen}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 transition-colors hover:bg-muted',
                  warnings ? 'text-amber-300' : 'text-muted-foreground',
                )}
              >
                {warnings ? <AlertTriangle className="h-3.5 w-3.5" /> : <Info className="h-3.5 w-3.5" />}
                {issues.length} {issues.length === 1 ? 'suggestion' : 'suggestions'}
                <ChevronDown className={cn('h-3 w-3 transition-transform', checksOpen && 'rotate-180')} />
              </button>
            ) : (
              <span />
            )}
            <span className="flex gap-3">
              <span>≈ {promptTokens.toLocaleString()} tokens</span>
              <span>{form.systemPrompt.length.toLocaleString()} chars</span>
            </span>
          </div>
          {checksOpen && issues.length > 0 ? (
            <ul className="mt-2 space-y-1.5 rounded-xl border border-border bg-muted/20 p-3" aria-label="Checks">
              {issues.map((issue) => (
                <li key={issue.message} className="flex items-start gap-2 text-xs">
                  {issue.level === 'warn' ? (
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                  ) : (
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className={issue.level === 'warn' ? 'text-foreground' : 'text-muted-foreground'}>{issue.message}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  )
}
