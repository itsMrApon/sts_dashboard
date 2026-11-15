'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { AudioWaveform, KeyRound, Loader2, RotateCcw, Workflow } from 'lucide-react'
import { toast } from 'sonner'
import { saveAgentEngineSettings } from '@/actions/agentEngine'
import { FishVoicePicker } from '@/components/agents/FishVoicePicker'
import { OpenRouterModelPicker } from '@/components/agents/OpenRouterModelPicker'
import { XaiModelPicker } from '@/components/agents/XaiModelPicker'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  BANGLA_LABEL,
  LLM_PROVIDER_OPTIONS,
  MAX_VOICE_STYLE_LENGTH,
  REALTIME_PROVIDER_OPTIONS,
  STT_PROVIDER_OPTIONS,
  VOICE_PROVIDER_OPTIONS,
  describeEngine,
  llmModelsForProvider,
  providersUsedBy,
  realtimeOption,
  sttOption,
  voiceOption,
  type AgentEngine,
  type BanglaSupport,
  type EngineMode,
  type RealtimeProvider,
  type SttProvider,
  type VoiceProvider,
} from '@/lib/agents/engineOptions'
import { defaultModelForLlmProvider, type LlmModelProvider } from '@/lib/llm/modelOptions'
import {
  configProviderById,
  type ConfigCredentialProvider,
  type ProviderKeyStatus,
} from '@/lib/usage/configProviders'
import { cn } from '@/lib/utils'
import { ProviderTile, TONE_DOT, keyTone } from './providerUi'
import { guardAction } from '@/lib/clientActionErrors'

type EngineDraft = AgentEngine & { voiceLabel: string | null }
type StatusMap = Record<ConfigCredentialProvider, ProviderKeyStatus>

const STYLE_PRESETS = [
  'Natural Bangladeshi Bangla accent, everyday colloquial (চলিত) speech.',
  'Warm, friendly and upbeat, like a helpful shop assistant.',
  'Calm, clear and professional. Short sentences.',
]

const ENGINE_KEYS: (keyof AgentEngine)[] = [
  'mode', 'sttProvider', 'sttModel', 'llmProvider', 'llmModel', 'voiceProvider', 'voiceModel', 'voiceStyle',
  'realtimeProvider', 'realtimeModel', 'realtimeVoice',
]

function sameEngine(a: EngineDraft, b: EngineDraft) {
  return ENGINE_KEYS.every((key) => a[key] === b[key])
}

const BANGLA_TONE: Record<BanglaSupport, string> = {
  yes: 'text-emerald-400',
  none: 'text-muted-foreground',
  untested: 'text-amber-400',
}

function BanglaTag({ support }: { support: BanglaSupport }) {
  return <span className={cn('text-[10px]', BANGLA_TONE[support])}>· {BANGLA_LABEL[support]}</span>
}

function NoKeyTag({ show }: { show: boolean }) {
  return show ? <span className="text-[10px] text-rose-400">· no key</span> : null
}

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-[11px] font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function StaticValue({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-9 items-center rounded-md border border-dashed border-border px-3 text-sm text-muted-foreground">
      {children}
    </div>
  )
}

function StyleField({ id, value, onChange }: { id: string; value: string | null; onChange: (next: string | null) => void }) {
  return (
    <Field label="Speaking style" htmlFor={id}>
      <Textarea
        id={id}
        rows={2}
        maxLength={MAX_VOICE_STYLE_LENGTH}
        placeholder="e.g. Natural Bangladeshi Bangla accent, warm and friendly."
        className="min-h-16 resize-none text-sm"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
      />
      <div className="flex flex-wrap gap-1">
        {STYLE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            className="max-w-full truncate rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {preset.split(',')[0]}
          </button>
        ))}
      </div>
    </Field>
  )
}

/** Short connector between stages: vertical when stacked, horizontal side by side. */
function Hop({ broken }: { broken: boolean }) {
  return (
    <div aria-hidden className="flex shrink-0 items-center justify-center py-1 lg:w-5 lg:py-0">
      <div
        className={cn(
          'h-4 w-px lg:h-px lg:w-full',
          broken
            ? 'border-l border-dashed border-rose-500/60 lg:border-t lg:border-l-0'
            : 'sts-signal-flow bg-[linear-gradient(180deg,transparent,var(--color-primary),transparent)] bg-[length:100%_200%] opacity-70 lg:bg-[linear-gradient(90deg,transparent,var(--color-primary),transparent)] lg:bg-[length:200%_100%]',
        )}
      />
    </div>
  )
}

function KeyChip({ status, onClick }: { status: ProviderKeyStatus; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
        status.hasKey
          ? 'border-border text-muted-foreground hover:text-foreground'
          : 'border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20',
      )}
    >
      <span className={cn('size-1.5 rounded-full', TONE_DOT[keyTone(status)])} aria-hidden />
      {status.hasKey ? 'Key' : 'Add key'}
    </button>
  )
}

function MissingKey({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 flex items-center gap-1.5 rounded-md bg-rose-500/10 px-2.5 py-2 text-left text-[11px] text-rose-300 transition-colors hover:bg-rose-500/15"
    >
      <KeyRound className="size-3.5 shrink-0" aria-hidden />
      No {name} key yet. Calls fail until you add one.
    </button>
  )
}

function Stage({
  step,
  role,
  provider,
  caption,
  status,
  onOpenKey,
  wide,
  children,
}: {
  step: string
  role: string
  provider: ConfigCredentialProvider
  caption: string
  status: ProviderKeyStatus
  onOpenKey: () => void
  wide?: boolean
  children: ReactNode
}) {
  const item = configProviderById(provider)
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col rounded-xl border bg-background/80 p-4 backdrop-blur',
        status.hasKey ? 'border-border' : 'border-rose-500/50',
        wide && 'lg:flex-[1.15]',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <span className="text-primary/70 tabular-nums">{step}</span> · {role}
        </span>
        <KeyChip status={status} onClick={onOpenKey} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <ProviderTile provider={item} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{caption}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-1 flex-col gap-3">{children}</div>
      {!status.hasKey ? <MissingKey name={item.name} onClick={onOpenKey} /> : null}
    </div>
  )
}

function ModeSwitch({ mode, onChange }: { mode: EngineMode; onChange: (mode: EngineMode) => void }) {
  const options: { value: EngineMode; title: string; badge: string; body: string; icon: typeof Workflow }[] = [
    {
      value: 'pipeline',
      title: 'Pipeline',
      badge: 'Mix & match',
      body: 'Pick who hears, thinks and speaks. Most control over voice and Bangla.',
      icon: Workflow,
    },
    {
      value: 'realtime',
      title: 'Realtime',
      badge: 'One model',
      body: 'One model hears, thinks and speaks. Fastest replies, most natural turn-taking.',
      icon: AudioWaveform,
    },
  ]
  return (
    <div role="radiogroup" aria-label="Engine mode" className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const active = mode === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex items-start gap-3 rounded-xl border p-3 text-left transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              active ? 'border-primary/50 bg-primary/10 shadow-sm' : 'border-border bg-background/50 hover:border-primary/30',
            )}
          >
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-lg',
                active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              <option.icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm font-medium">
                {option.title}
                <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-normal text-muted-foreground">
                  {option.badge}
                </span>
              </span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">{option.body}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function EngineComposer({
  engine,
  voiceLabel,
  savedBefore,
  agentCount,
  statuses,
  onOpenKey,
  onSaved,
}: {
  engine: AgentEngine
  voiceLabel: string | null
  /** False until the user saves once; until then the draft mirrors what agents already run. */
  savedBefore: boolean
  agentCount: number
  statuses: StatusMap
  onOpenKey: (provider: ConfigCredentialProvider) => void
  onSaved: (engine: AgentEngine, voiceLabel: string | null) => void
}) {
  const initial: EngineDraft = { ...engine, voiceLabel }
  const [draft, setDraft] = useState<EngineDraft>(initial)
  const [baseline, setBaseline] = useState<EngineDraft>(initial)
  const [persisted, setPersisted] = useState(savedBefore)
  const [isSaving, startSaving] = useTransition()

  const update = (patch: Partial<EngineDraft>) => setDraft((current) => ({ ...current, ...patch }))
  const dirty = !sameEngine(draft, baseline)
  const needsVoice = draft.mode === 'pipeline' && !draft.voiceModel.trim()
  const canSave = (dirty || !persisted) && !needsVoice
  const summary = describeEngine(draft, draft.voiceLabel)
  const missing = (providersUsedBy(draft) as ConfigCredentialProvider[]).filter((provider) => !statuses[provider].hasKey)

  const stt = sttOption(draft.sttProvider)
  const voice = voiceOption(draft.voiceProvider)
  const realtime = realtimeOption(draft.realtimeProvider)
  const llmModels = llmModelsForProvider(draft.llmProvider)

  const save = () =>
    startSaving(guardAction(async () => {
      const result = await saveAgentEngineSettings(draft)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const next = { ...result.engine, voiceLabel: draft.voiceLabel }
      setDraft(next)
      setBaseline(next)
      setPersisted(true)
      onSaved(result.engine, draft.voiceLabel)
      toast.success(
        `AI engine saved. ${result.agentsUpdated} agent${result.agentsUpdated === 1 ? '' : 's'} use it on the next call.`,
      )
    }))

  return (
    <section
      id="ai-engine"
      className="relative scroll-mt-6 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/[0.07] via-background to-background"
    >
      <style>{`
        @keyframes sts-signal-flow-x { from { background-position: 200% 0 } to { background-position: -200% 0 } }
        @keyframes sts-signal-flow-y { from { background-position: 0 200% } to { background-position: 0 -200% } }
        @media (prefers-reduced-motion: no-preference) {
          .sts-signal-flow { animation: sts-signal-flow-y 2.4s linear infinite }
          @media (min-width: 1024px) { .sts-signal-flow { animation-name: sts-signal-flow-x } }
        }
      `}</style>
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative space-y-5 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              AI engine · shared by every agent
            </p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight md:text-xl">
              {missing.length === 0
                ? draft.mode === 'realtime'
                  ? `${realtime.product} is ready.`
                  : 'Hears, thinks, speaks. Every step has a key.'
                : `${missing.length} provider${missing.length === 1 ? '' : 's'} missing a key`}
            </h1>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              Choose how your agents talk on calls. Prompts, first messages and language stay on each agent.
            </p>
          </div>
          {dirty ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
              <span className="size-1.5 rounded-full bg-amber-400" aria-hidden />
              Unsaved changes
            </span>
          ) : !persisted ? (
            <span className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground">
              Showing what agents run today
            </span>
          ) : null}
        </div>

        <ModeSwitch mode={draft.mode} onChange={(mode) => update({ mode })} />

        {draft.mode === 'pipeline' ? (
          <div className="flex flex-col lg:flex-row lg:items-stretch">
            <Stage
              step="01"
              role="Hears"
              provider={draft.sttProvider}
              caption={summary.stt}
              status={statuses[draft.sttProvider]}
              onOpenKey={() => onOpenKey(draft.sttProvider)}
            >
              <Field label="Provider" htmlFor="engine-stt-provider" hint={stt.note}>
                <Select
                  value={draft.sttProvider}
                  onValueChange={(value) => {
                    const next = sttOption(value as SttProvider)
                    update({ sttProvider: next.value, sttModel: next.models[0].id || null })
                  }}
                >
                  <SelectTrigger id="engine-stt-provider" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STT_PROVIDER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                        <BanglaTag support={option.bangla} />
                        <NoKeyTag show={!statuses[option.value].hasKey} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Model" htmlFor="engine-stt-model">
                {stt.models.length > 1 ? (
                  <Select value={draft.sttModel ?? stt.models[0].id} onValueChange={(value) => update({ sttModel: value })}>
                    <SelectTrigger id="engine-stt-model" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stt.models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <StaticValue>{stt.models[0].label}</StaticValue>
                )}
              </Field>
            </Stage>

            <Hop broken={!statuses[draft.sttProvider].hasKey || !statuses[draft.llmProvider].hasKey} />

            <Stage
              step="02"
              role="Thinks"
              provider={draft.llmProvider}
              caption={summary.llm}
              status={statuses[draft.llmProvider]}
              onOpenKey={() => onOpenKey(draft.llmProvider)}
            >
              <Field label="Provider" htmlFor="engine-llm-provider">
                <Select
                  value={draft.llmProvider}
                  onValueChange={(value) => {
                    const provider = value as LlmModelProvider
                    update({ llmProvider: provider, llmModel: defaultModelForLlmProvider(provider) })
                  }}
                >
                  <SelectTrigger id="engine-llm-provider" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LLM_PROVIDER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value} disabled={!option.enabled}>
                        {option.label}
                        <NoKeyTag show={!statuses[option.value].hasKey} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Model" htmlFor="engine-llm-model">
                {draft.llmProvider === 'openrouter' ? (
                  <OpenRouterModelPicker value={draft.llmModel} onChange={(llmModel) => update({ llmModel })} />
                ) : draft.llmProvider === 'xai' ? (
                  <XaiModelPicker id="engine-llm-model" value={draft.llmModel} onChange={(llmModel) => update({ llmModel })} />
                ) : (
                  <Select value={draft.llmModel} onValueChange={(llmModel) => update({ llmModel })}>
                    <SelectTrigger id="engine-llm-model" className="w-full">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {llmModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
            </Stage>

            <Hop broken={!statuses[draft.llmProvider].hasKey || !statuses[draft.voiceProvider].hasKey} />

            <Stage
              step="03"
              role="Speaks"
              provider={draft.voiceProvider}
              caption={summary.voice}
              status={statuses[draft.voiceProvider]}
              onOpenKey={() => onOpenKey(draft.voiceProvider)}
              wide
            >
              <Field label="Provider" htmlFor="engine-voice-provider" hint={voice.note}>
                <Select
                  value={draft.voiceProvider}
                  onValueChange={(value) => {
                    const next = voiceOption(value as VoiceProvider)
                    const keepFish = next.value === 'fish' && draft.voiceProvider === 'fish'
                    update({
                      voiceProvider: next.value,
                      voiceModel: keepFish ? draft.voiceModel : next.defaultVoice,
                      voiceLabel: keepFish ? draft.voiceLabel : null,
                    })
                  }}
                >
                  <SelectTrigger id="engine-voice-provider" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICE_PROVIDER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                        <BanglaTag support={option.bangla} />
                        <NoKeyTag show={!statuses[option.value].hasKey} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Voice">
                {voice.voices ? (
                  <Select value={draft.voiceModel} onValueChange={(voiceModel) => update({ voiceModel })}>
                    <SelectTrigger aria-label={`${voice.label} voice`} className="w-full">
                      <SelectValue placeholder="Select a voice" />
                    </SelectTrigger>
                    <SelectContent>
                      {voice.voices.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <FishVoicePicker
                    value={draft.voiceModel}
                    valueLabel={draft.voiceLabel}
                    onChange={(voiceModel, nextLabel) => update({ voiceModel, voiceLabel: nextLabel })}
                  />
                )}
              </Field>
              {voice.acceptsStyle ? (
                <StyleField id="engine-voice-style" value={draft.voiceStyle} onChange={(voiceStyle) => update({ voiceStyle })} />
              ) : null}
            </Stage>
          </div>
        ) : (
          <div
            className={cn(
              'grid gap-4 rounded-xl border bg-background/80 p-4 backdrop-blur md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]',
              statuses[draft.realtimeProvider].hasKey ? 'border-border' : 'border-rose-500/50',
            )}
          >
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Hears · thinks · speaks
              </p>
              <div role="radiogroup" aria-label="Realtime provider" className="space-y-2">
                {REALTIME_PROVIDER_OPTIONS.map((option) => {
                  const item = configProviderById(option.value)
                  const active = draft.realtimeProvider === option.value
                  const status = statuses[option.value]
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() =>
                        update({
                          realtimeProvider: option.value as RealtimeProvider,
                          realtimeModel: option.models[0].id,
                          realtimeVoice: option.voices[0].id,
                        })
                      }
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors',
                        active ? 'border-primary/50 bg-primary/10' : 'border-border hover:border-primary/30',
                      )}
                    >
                      <ProviderTile provider={item} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{option.product}</span>
                        <span className="flex items-center gap-1 text-[10px]">
                          <span className={BANGLA_TONE[option.bangla]}>{BANGLA_LABEL[option.bangla]}</span>
                          {!status.hasKey ? <span className="text-rose-400">· no key</span> : null}
                        </span>
                      </span>
                      <span className={cn('size-2 shrink-0 rounded-full', TONE_DOT[keyTone(status)])} aria-hidden />
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">{realtime.note}</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{realtime.product}</p>
                <KeyChip status={statuses[draft.realtimeProvider]} onClick={() => onOpenKey(draft.realtimeProvider)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Model" htmlFor="engine-realtime-model">
                  <Select value={draft.realtimeModel} onValueChange={(realtimeModel) => update({ realtimeModel })}>
                    <SelectTrigger id="engine-realtime-model" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {realtime.models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Voice" htmlFor="engine-realtime-voice">
                  <Select value={draft.realtimeVoice} onValueChange={(realtimeVoice) => update({ realtimeVoice })}>
                    <SelectTrigger id="engine-realtime-voice" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {realtime.voices.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <StyleField id="engine-realtime-style" value={draft.voiceStyle} onChange={(voiceStyle) => update({ voiceStyle })} />
              <p className="text-[11px] text-muted-foreground">
                Cloned Fish voices and per-stage choices only work in Pipeline mode.
              </p>
              {!statuses[draft.realtimeProvider].hasKey ? (
                <MissingKey
                  name={configProviderById(draft.realtimeProvider).name}
                  onClick={() => onOpenKey(draft.realtimeProvider)}
                />
              ) : null}
            </div>
          </div>
        )}
      </div>

      <div className="relative flex flex-col gap-3 border-t border-border bg-background/60 px-5 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <p className="min-w-0 text-xs text-muted-foreground">
          {draft.mode === 'realtime' ? (
            <>
              <span className="text-foreground">{summary.llmProvider}</span> · {summary.llm} ·{' '}
              <span className="text-foreground">{summary.voice}</span>
            </>
          ) : (
            <>
              <span className="text-foreground">{summary.sttProvider}</span> →{' '}
              <span className="text-foreground">{summary.llm}</span> →{' '}
              <span className="text-foreground">{summary.voice}</span>
            </>
          )}
          <span className="block sm:inline">
            {' '}
            {agentCount === 0
              ? '· applies to every agent you create'
              : `· applies to ${agentCount === 1 ? 'your agent' : `all ${agentCount} agents`} on the next call`}
          </span>
        </p>
        <div className="flex shrink-0 gap-2">
          {dirty ? (
            <Button variant="ghost" size="sm" onClick={() => setDraft(baseline)} disabled={isSaving}>
              <RotateCcw />
              Reset
            </Button>
          ) : null}
          <Button size="sm" onClick={save} disabled={!canSave || isSaving}>
            {isSaving ? <Loader2 className="animate-spin" /> : null}
            {isSaving ? 'Saving…' : 'Save engine'}
          </Button>
        </div>
      </div>
    </section>
  )
}
