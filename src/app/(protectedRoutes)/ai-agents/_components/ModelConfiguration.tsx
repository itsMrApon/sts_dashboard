'use client'
import { updateAssistant } from '@/actions/vapi'
import { updateLiveKitAgent } from '@/actions/livekitAgent'
import type { AgentEngineView } from '@/actions/agentEngine'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAiAgentStore } from '@/store/useAiAgentstore'
import type { Assistant } from '@vapi-ai/server-sdk/api'
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

const EMPTY_FORM: BehaviorForm = { firstMessage: '', systemPrompt: '', language: 'en' }

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

function EngineStrip({ engineView, source, assistant }: { engineView: AgentEngineView | null; source: 'vapi' | 'livekit'; assistant: Assistant | null }) {
  if (source === 'vapi') {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-2 text-xs text-neutral-400">
        <span className="flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5" />
          {assistant?.model?.provider || 'Vapi'} · {assistant?.model?.model || 'default model'}
        </span>
        <span>Engine is managed in Vapi for this assistant.</span>
      </div>
    )
  }
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

const ModelConfiguration = ({ engineView }: { engineView: AgentEngineView | null }) => {
  const {
    assistant: selectedAssistant,
    livekitAgent,
    source,
    setLivekitAgent,
    setHasUnsavedChanges,
  } = useAiAgentStore()
  const assistant = selectedAssistant as Assistant | null
  const router = useRouter()
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const [saving, setSaving] = useState(false)

  const baseline = useMemo<BehaviorForm>(() => {
    if (source === 'livekit' && livekitAgent) {
      return {
        firstMessage: livekitAgent.firstMessage || '',
        systemPrompt: livekitAgent.systemPrompt || '',
        language: isAgentLanguage(livekitAgent.language) ? livekitAgent.language : 'en',
      }
    }
    if (source === 'vapi' && assistant) {
      return {
        firstMessage: assistant.firstMessage || '',
        systemPrompt: assistant.model?.messages?.[0]?.content || '',
        language: 'en',
      }
    }
    return EMPTY_FORM
  }, [source, livekitAgent, assistant])

  const [form, setForm] = useState<BehaviorForm>(baseline)
  useEffect(() => setForm(baseline), [baseline])

  const dirty =
    form.firstMessage !== baseline.firstMessage ||
    form.systemPrompt !== baseline.systemPrompt ||
    form.language !== baseline.language

  useEffect(() => {
    setHasUnsavedChanges(dirty)
  }, [dirty, setHasUnsavedChanges])
  useEffect(() => () => setHasUnsavedChanges(false), [setHasUnsavedChanges])

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const issues = useMemo(() => (source === 'livekit' ? lintAgentText(form) : []), [form, source])
  const outline = useMemo(() => outlinePrompt(form.systemPrompt), [form.systemPrompt])
  const promptTokens = useMemo(() => estimateTokens(form.systemPrompt), [form.systemPrompt])

  const handleSave = useCallback(async () => {
    if (!dirty || saving) return
    setSaving(true)
    try {
      if (source === 'vapi' && assistant) {
        const res = await updateAssistant(assistant.id as string, form.firstMessage, form.systemPrompt)
        if (!res.success) throw new Error(res.message)
        toast.success('Assistant updated.')
        router.refresh()
      } else if (source === 'livekit' && livekitAgent) {
        const res = await updateLiveKitAgent(livekitAgent.id, form)
        if (!res.success || !res.data) {
          toast.error(res.error || 'Failed to update the agent.')
          return
        }
        // New baseline = what the server stored (Bangla text is kept byte-for-byte).
        setLivekitAgent(res.data)
        toast.success('Agent saved — new calls use these changes.')
        router.refresh()
      }
    } catch (error) {
      console.error('Error updating model configuration:', error)
      toast.error('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [dirty, saving, source, assistant, livekitAgent, form, router, setLivekitAgent])

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

  if ((source === 'vapi' && !assistant) || (source === 'livekit' && !livekitAgent)) {
    return (
      <div className="flex h-[500px] w-full items-center justify-center">
        <div className="w-full rounded-xl bg-neutral-900 p-6">
          <p className="text-center text-primary/80">
            Select an agent to edit its first message, prompt and language.
          </p>
        </div>
      </div>
    )
  }

  const isLivekit = source === 'livekit' && livekitAgent
  const agentName = isLivekit ? livekitAgent.name : assistant?.name || 'Assistant'
  const setField = <K extends keyof BehaviorForm>(key: K, value: BehaviorForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  return (
    <div className="mb-6 rounded-xl bg-neutral-900">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-t-xl border-b border-white/5 bg-neutral-900/95 px-6 py-4 backdrop-blur">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold">{agentName}</h2>
          <p className="flex items-center gap-1.5 text-xs text-neutral-400">
            <span
              className={cn('h-1.5 w-1.5 rounded-full', dirty ? 'bg-amber-400' : 'bg-emerald-400')}
              aria-hidden
            />
            {dirty ? 'Unsaved changes' : 'All changes saved'}
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

      <div className="space-y-6 p-6">
        <EngineStrip engineView={engineView} source={source} assistant={assistant} />

        {isLivekit ? (
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
        ) : null}

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
          {isLivekit ? (
            <div className="mt-2">
              <AgentAiEditor
                compact
                agentId={livekitAgent.id}
                field="firstMessage"
                value={form.firstMessage}
                language={form.language}
                systemPromptContext={form.systemPrompt}
                onApply={(text) => setField('firstMessage', text)}
              />
            </div>
          ) : null}
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
          {isLivekit ? (
            <div className="mt-2">
              <AgentAiEditor
                agentId={livekitAgent.id}
                field="systemPrompt"
                value={form.systemPrompt}
                language={form.language}
                onApply={(text) => setField('systemPrompt', text)}
              />
            </div>
          ) : null}
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

export default ModelConfiguration
