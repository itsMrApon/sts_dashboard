'use client'

import { useCallback, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowDown,
  ArrowUp,
  Copy,
  ExternalLink,
  Loader2,
  Play,
  Plus,
  Save,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  draftVoiceWizardSteps,
  setVoiceWizardPublished,
  updateVoiceWizard,
} from '@/actions/voiceWizard'
import { WizardGem } from '@/components/wizard/WizardGem'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { SERVICE_SNIPPETS } from '@/lib/services/snippets'
import {
  WIZARD_LANGUAGES,
  WIZARD_LIMITS,
  WIZARD_SHAPES,
  WIZARD_THEMES,
  WIZARD_VOICES,
  emptyStep,
  resolveTheme,
  spokenText,
  type VoiceWizardStep,
  type WizardLanguage,
  type WizardShape,
  type WizardThemeId,
} from '@/lib/wizard/types'

type EditableWizard = {
  slug: string
  name: string
  guideName: string
  language: WizardLanguage
  voice: string
  theme: WizardThemeId
  shape: WizardShape
  steps: VoiceWizardStep[]
  isPublished: boolean
}

type Props = {
  initialWizard: EditableWizard
}

const SELECT_CLASS = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm'

function settingsSnapshot(wizard: EditableWizard) {
  return JSON.stringify({ ...wizard, isPublished: undefined })
}

export function WizardConfigurator({ initialWizard }: Props) {
  const router = useRouter()
  const [wizard, setWizard] = useState<EditableWizard>(initialWizard)
  const [savedSnapshot, setSavedSnapshot] = useState(() => settingsSnapshot(initialWizard))
  const [savedSteps, setSavedSteps] = useState(() => new Map(initialWizard.steps.map((s) => [s.id, spokenText(s)])))
  const [selectedStepId, setSelectedStepId] = useState(initialWizard.steps[0]?.id ?? null)
  const [playingStepId, setPlayingStepId] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()
  const [isDrafting, startDrafting] = useTransition()
  const [isPublishing, startPublishing] = useTransition()
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const isDirty = settingsSnapshot(wizard) !== savedSnapshot
  const palette = resolveTheme(wizard.theme)
  const selectedStep = wizard.steps.find((step) => step.id === selectedStepId) ?? wizard.steps[0]
  const publicPath = `/wizard/${wizard.slug}`

  const patch = useCallback((partial: Partial<EditableWizard>) => {
    setWizard((current) => ({ ...current, ...partial }))
  }, [])

  const patchStep = useCallback((id: string, partial: Partial<VoiceWizardStep>) => {
    setWizard((current) => ({
      ...current,
      steps: current.steps.map((step) => (step.id === id ? { ...step, ...partial } : step)),
    }))
  }, [])

  const moveStep = (index: number, direction: -1 | 1) => {
    setWizard((current) => {
      const target = index + direction
      if (target < 0 || target >= current.steps.length) return current
      const steps = [...current.steps]
      ;[steps[index], steps[target]] = [steps[target], steps[index]]
      return { ...current, steps }
    })
  }

  const removeStep = (id: string) => {
    setWizard((current) => ({ ...current, steps: current.steps.filter((step) => step.id !== id) }))
  }

  const addStep = () => {
    if (wizard.steps.length >= WIZARD_LIMITS.maxSteps) {
      toast.error(`Up to ${WIZARD_LIMITS.maxSteps} steps`)
      return
    }
    const step = emptyStep()
    setWizard((current) => ({ ...current, steps: [...current.steps, step] }))
    setSelectedStepId(step.id)
  }

  const save = () => {
    startSaving(async () => {
      const result = await updateVoiceWizard(wizard.slug, {
        name: wizard.name,
        guideName: wizard.guideName,
        language: wizard.language,
        voice: wizard.voice,
        theme: wizard.theme,
        shape: wizard.shape,
        steps: wizard.steps,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const next = { ...wizard, steps: result.steps }
      setWizard(next)
      setSavedSnapshot(settingsSnapshot(next))
      setSavedSteps(new Map(result.steps.map((s) => [s.id, spokenText(s)])))
      toast.success(wizard.isPublished ? 'Saved — live page updated' : 'Saved')
      router.refresh()
    })
  }

  const draftWithAi = () => {
    startDrafting(async () => {
      const result = await draftVoiceWizardSteps({
        slug: wizard.slug,
        name: wizard.name,
        guideName: wizard.guideName,
        language: wizard.language,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      patch({ steps: result.steps })
      setSelectedStepId(result.steps[0]?.id ?? null)
      if (result.source === 'ai') toast.success('Draft ready — review it, then Save')
      else toast.message('Used the built-in template', { description: result.note })
    })
  }

  const togglePublished = (published: boolean) => {
    if (isDirty) {
      toast.error('Save your changes before publishing')
      return
    }
    startPublishing(async () => {
      const result = await setVoiceWizardPublished(wizard.slug, published)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      patch({ isPublished: published })
      if (published && result.audioFailures > 0) {
        toast.warning(`Published, but ${result.audioFailures} clip(s) failed — they'll use the browser voice.`)
      } else {
        toast.success(published ? 'Wizard is live' : 'Wizard unpublished')
      }
      router.refresh()
    })
  }

  const stopPreview = useCallback(() => {
    audioRef.current?.pause()
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setPlayingStepId(null)
  }, [])

  /** Saved English steps play the real Deepgram clip; unsaved/Bangla steps use the browser voice. */
  const previewStep = (step: VoiceWizardStep) => {
    if (playingStepId === step.id) {
      stopPreview()
      return
    }
    stopPreview()
    const text = spokenText(step)
    if (!text) return
    setPlayingStepId(step.id)

    const isSaved = savedSteps.get(step.id) === text && !isDirty
    if (wizard.language === 'en' && isSaved) {
      const audio = audioRef.current ?? new Audio()
      audioRef.current = audio
      audio.src = `/api/wizard/${encodeURIComponent(wizard.slug)}/audio/${encodeURIComponent(step.id)}?v=preview-${Date.now()}`
      audio.onended = () => setPlayingStepId(null)
      audio.onerror = () => {
        setPlayingStepId(null)
        toast.error('Could not load the voice clip')
      }
      void audio.play().catch(() => setPlayingStepId(null))
      return
    }

    if (!('speechSynthesis' in window)) {
      setPlayingStepId(null)
      toast.error('This browser has no speech preview')
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = wizard.language === 'bn' ? 'bn-BD' : 'en-US'
    utterance.onend = () => setPlayingStepId(null)
    utterance.onerror = () => setPlayingStepId(null)
    window.speechSynthesis.speak(utterance)
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}${publicPath}`)
    toast.success('Link copied')
  }

  const voiceLabel = useMemo(
    () => WIZARD_VOICES.find((voice) => voice.id === wizard.voice)?.label ?? wizard.voice,
    [wizard.voice],
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{wizard.name || 'Untitled wizard'}</h1>
              <Badge variant={wizard.isPublished ? 'default' : 'secondary'}>{wizard.isPublished ? 'Live' : 'Draft'}</Badge>
              {isDirty ? <span className="text-xs text-amber-500">Unsaved changes</span> : null}
            </div>
            <p className="text-xs text-muted-foreground">{publicPath}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm">
            {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Published
            <Switch checked={wizard.isPublished} onCheckedChange={togglePublished} disabled={isPublishing} />
          </label>
          <Button variant="outline" size="sm" onClick={copyLink}>
            <Copy className="mr-1.5 h-4 w-4" />
            Copy link
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={publicPath} target="_blank">
              <ExternalLink className="mr-1.5 h-4 w-4" />
              {wizard.isPublished ? 'Open' : 'Preview'}
            </Link>
          </Button>
          <Button size="sm" onClick={save} disabled={isSaving || !isDirty}>
            {isSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          {/* Basics */}
          <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-5">
            <h2 className="text-sm font-semibold">Basics</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wizard-name">Wizard name</Label>
                <Input id="wizard-name" value={wizard.name} maxLength={WIZARD_LIMITS.name} onChange={(e) => patch({ name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guide-name">Guide name</Label>
                <Input
                  id="guide-name"
                  value={wizard.guideName}
                  maxLength={WIZARD_LIMITS.guideName}
                  onChange={(e) => patch({ guideName: e.target.value })}
                  placeholder="Nova"
                />
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <div className="grid grid-cols-2 gap-2">
                  {WIZARD_LANGUAGES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => patch({ language: option.id })}
                      className={cn(
                        'h-9 rounded-md border text-sm',
                        wizard.language === option.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/60',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="wizard-voice">Voice</Label>
                {wizard.language === 'en' ? (
                  <select id="wizard-voice" className={SELECT_CLASS} value={wizard.voice} onChange={(e) => patch({ voice: e.target.value })}>
                    {WIZARD_VOICES.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                    Bangla narration uses the visitor&apos;s browser voice for now. If their device has no Bangla voice,
                    captions still advance automatically.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Look */}
          <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-5">
            <h2 className="text-sm font-semibold">Look</h2>
            <div className="space-y-2">
              <Label>Theme</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(Object.keys(WIZARD_THEMES) as WizardThemeId[]).map((themeId) => (
                  <button
                    key={themeId}
                    type="button"
                    onClick={() => patch({ theme: themeId })}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border p-2 text-sm',
                      wizard.theme === themeId ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/60',
                    )}
                  >
                    <span
                      className="h-6 w-6 rounded-full border border-white/10"
                      style={{
                        background: `linear-gradient(135deg, ${WIZARD_THEMES[themeId].colors.join(', ')})`,
                      }}
                    />
                    {WIZARD_THEMES[themeId].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Shape</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {WIZARD_SHAPES.map((shape) => (
                  <button
                    key={shape.id}
                    type="button"
                    onClick={() => patch({ shape: shape.id })}
                    className={cn(
                      'h-9 rounded-md border text-sm',
                      wizard.shape === shape.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/60',
                    )}
                  >
                    {shape.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Steps */}
          <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Tour steps</h2>
                <p className="text-xs text-muted-foreground">
                  Each step is a section on the page. The guide speaks the narration, then moves on.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={draftWithAi} disabled={isDrafting}>
                  {isDrafting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                  Draft with AI
                </Button>
                <Button variant="outline" size="sm" onClick={addStep}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add step
                </Button>
              </div>
            </div>

            {wizard.steps.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                No steps yet — draft with AI or add one.
              </p>
            ) : null}

            <ol className="space-y-3">
              {wizard.steps.map((step, index) => (
                <li
                  key={step.id}
                  onFocusCapture={() => setSelectedStepId(step.id)}
                  onClick={() => setSelectedStepId(step.id)}
                  className={cn(
                    'space-y-3 rounded-xl border p-4 transition-colors',
                    selectedStep?.id === step.id ? 'border-primary/60 bg-primary/5' : 'border-border',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Step {index + 1}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => previewStep(step)} aria-label="Preview voice">
                        {playingStepId === step.id ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => moveStep(index, -1)} aria-label="Move up">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={index === wizard.steps.length - 1}
                        onClick={() => moveStep(index, 1)}
                        aria-label="Move down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeStep(step.id)} aria-label="Delete step">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <Input
                    value={step.heading}
                    maxLength={WIZARD_LIMITS.heading}
                    onChange={(e) => patchStep(step.id, { heading: e.target.value })}
                    placeholder="Section heading"
                  />
                  <Textarea
                    value={step.body}
                    maxLength={WIZARD_LIMITS.body}
                    onChange={(e) => patchStep(step.id, { body: e.target.value })}
                    placeholder="Text shown on the page"
                    rows={2}
                  />
                  <div className="space-y-1">
                    <Textarea
                      value={step.narration}
                      maxLength={WIZARD_LIMITS.narration}
                      onChange={(e) => patchStep(step.id, { narration: e.target.value })}
                      placeholder="What the guide says (defaults to heading + text)"
                      rows={3}
                    />
                    <p className="text-right text-[10px] text-muted-foreground">
                      {step.narration.length}/{WIZARD_LIMITS.narration}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Input
                      value={step.target}
                      maxLength={WIZARD_LIMITS.target}
                      onChange={(e) => patchStep(step.id, { target: e.target.value })}
                      placeholder="Website section (optional) — e.g. pricing"
                    />
                    {step.target ? (
                      <p className="text-[10px] text-muted-foreground">
                        On your site: <code>{`<section data-sts-step="${step.target}">`}</code>
                      </p>
                    ) : null}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)]">
                    <Input
                      value={step.ctaLabel}
                      maxLength={WIZARD_LIMITS.ctaLabel}
                      onChange={(e) => patchStep(step.id, { ctaLabel: e.target.value })}
                      placeholder="Button label"
                    />
                    <Input
                      value={step.ctaUrl}
                      maxLength={WIZARD_LIMITS.ctaUrl}
                      onChange={(e) => patchStep(step.id, { ctaUrl: e.target.value })}
                      placeholder="https://… or /chat/your-room"
                    />
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Live preview */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div
            className={cn(
              'flex flex-col items-center gap-4 rounded-3xl border border-border p-6 text-center',
              palette.isLight ? 'text-zinc-900' : 'text-zinc-50',
            )}
            style={{ backgroundColor: palette.colorBack }}
          >
            <WizardGem theme={wizard.theme} shape={wizard.shape} size={180} speaking={playingStepId !== null} />
            <p className="text-lg font-medium">
              {wizard.language === 'bn' ? `হ্যালো! আমি ${wizard.guideName || 'Nova'}।` : `Oh, hi! I'm ${wizard.guideName || 'Nova'}.`}
            </p>
            {selectedStep ? (
              <div className={cn('w-full rounded-2xl border p-3 text-left text-sm', palette.isLight ? 'border-black/10 bg-white/70' : 'border-white/10 bg-white/5')}>
                <p className="mb-1 text-xs font-semibold">{selectedStep.heading || 'Untitled step'}</p>
                <p className={palette.isLight ? 'text-zinc-600' : 'text-zinc-300'}>{spokenText(selectedStep) || '…'}</p>
              </div>
            ) : null}
            <p className={cn('text-xs', palette.isLight ? 'text-zinc-500' : 'text-zinc-400')}>
              {wizard.language === 'en' ? voiceLabel : 'Browser voice (Bangla)'} · {wizard.steps.length} steps
            </p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Publishing pre-records every English line once. Visitors replay the stored clips, so tours don&apos;t
            add per-visit voice costs.
          </p>
          <div className="mt-4 space-y-2 rounded-2xl border border-border bg-card/60 p-4">
            <p className="text-xs font-semibold">On your own website (SDK)</p>
            <pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 text-[10px] leading-relaxed">
              <code>{SERVICE_SNIPPETS.wizard()}</code>
            </pre>
            <p className="text-[10px] text-muted-foreground">
              Set a website section on each step, tag that section with <code>data-sts-step</code>, and publish. Site key
              and allowed website: any service&apos;s Integrate tab.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
