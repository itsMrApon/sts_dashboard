'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowDown,
  ArrowUp,
  Compass,
  Footprints,
  Loader2,
  Palette,
  Play,
  Plus,
  Sparkles,
  Square,
  Trash2,
  UserRound,
  Waves,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  draftVoiceWizardSteps,
  setVoiceWizardPublished,
  updateVoiceWizard,
} from '@/actions/voiceWizard'
import type { AssistantSummary } from '@/actions/assistants'
import { ServiceAssistantPicker } from '@/components/services/studio/ServiceAssistantPicker'
import { ServiceStudio } from '@/components/services/studio/ServiceStudio'
import { WizardTour } from '@/app/(publicRoutes)/wizard/[slug]/_components/WizardTour'
import { Field, Segmented, StudioSection, ToggleRow } from '@/components/services/studio/StudioPrimitives'
import { WizardGem } from '@/components/wizard/WizardGem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  WIZARD_LANGUAGES,
  WIZARD_LIMITS,
  WIZARD_PAUSES,
  WIZARD_SHAPES,
  WIZARD_THEMES,
  WIZARD_VOICES,
  emptyStep,
  resolveTheme,
  spokenText,
  type PublicWizard,
  type VoiceWizardStep,
  type WizardLanguage,
  type WizardSettings,
  type WizardShape,
  type WizardThemeId,
} from '@/lib/wizard/types'
import { guardAction } from '@/lib/clientActionErrors'

type EditableWizard = {
  slug: string
  name: string
  guideName: string
  language: WizardLanguage
  voice: string
  theme: WizardThemeId
  shape: WizardShape
  steps: VoiceWizardStep[]
  settings: WizardSettings
  isPublished: boolean
  /** Set when this is a product's own profile; its AI agent is chosen in the product's settings. */
  product?: { id: string; title: string; agentName: string | null } | null
}

type Props = {
  initialWizard: EditableWizard
  /**
   * full: a product's tour (everything here). service: Services → Tour (assistant, looks, publish).
   * assistant: AI Agents → the Tour assistant (guide, playback, steps).
   */
  part?: 'full' | 'service' | 'assistant'
  /** service part: assistants to pick from, and the one running the tour. */
  assistants?: AssistantSummary[]
  tourAssistantId?: string | null
  /** assistant part: the Tour assistant's name (header). */
  assistantName?: string
  /** Shown in the live tour's header. */
  businessName?: string
}

const SELECT_CLASS = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm'
const SECTIONS = {
  full: [
    { id: 'basics', label: 'Basics' },
    { id: 'look', label: 'Look' },
    { id: 'playback', label: 'Playback' },
    { id: 'steps', label: 'Steps' },
  ],
  service: [],
  assistant: [
    { id: 'basics', label: 'Basics' },
    { id: 'playback', label: 'Playback' },
    { id: 'steps', label: 'Steps' },
  ],
}

/** Short content hash: a saved step's narration clip URL changes when its text does. */
function textVersion(text: string): string {
  let hash = 0
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) | 0
  return (hash >>> 0).toString(36)
}

function settingsSnapshot(wizard: EditableWizard) {
  return JSON.stringify({ ...wizard, isPublished: undefined })
}

export function WizardConfigurator({
  initialWizard,
  part = 'full',
  assistants = [],
  tourAssistantId = null,
  assistantName,
  businessName = '',
}: Props) {
  const showBehaviour = part !== 'service'
  const showLook = part !== 'assistant'
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

  // "Go to steps" (product settings) links to #tour-steps. The app scrolls inside its own panel,
  // so the browser's hash jump doesn't reach it: bring the section into view ourselves.
  useEffect(() => {
    if (window.location.hash !== '#tour-steps') return
    const frame = window.requestAnimationFrame(() =>
      document.getElementById('studio-steps')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    )
    return () => window.cancelAnimationFrame(frame)
  }, [])

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
    startSaving(guardAction(async () => {
      const result = await updateVoiceWizard(wizard.slug, {
        name: wizard.name,
        guideName: wizard.guideName,
        language: wizard.language,
        voice: wizard.voice,
        theme: wizard.theme,
        shape: wizard.shape,
        steps: wizard.steps,
        settings: wizard.settings,
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
    }))
  }

  const draftWithAi = () => {
    startDrafting(guardAction(async () => {
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
      else toast.info('Used the built-in template', { description: result.note })
    }))
  }

  const togglePublished = (published: boolean) => {
    if (published && part === 'service' && !tourAssistantId) {
      toast.error('Pick a Tour assistant first.')
      return
    }
    if (isDirty) {
      toast.error('Save your changes before publishing')
      return
    }
    startPublishing(guardAction(async () => {
      const result = await setVoiceWizardPublished(wizard.slug, published)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      patch({ isPublished: published })
      if (published && result.audioKeyMissing) {
        toast.warning('Wizard is live with the browser voice. Add your Deepgram API key in AI Agents → Config for the AI voice.', {
          action: { label: 'Open Config', onClick: () => router.push('/ai-agents/config?provider=deepgram') },
        })
      } else if (published && result.audioFailures > 0) {
        toast.warning(`Published, but ${result.audioFailures} clip(s) failed — they'll use the browser voice.`)
      } else {
        toast.success(published ? 'Wizard is live' : 'Wizard unpublished')
      }
      router.refresh()
    }))
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

  const voiceLabel = useMemo(
    () => WIZARD_VOICES.find((voice) => voice.id === wizard.voice)?.label ?? wizard.voice,
    [wizard.voice],
  )
  const patchSettings = (partial: Partial<WizardSettings>) => patch({ settings: { ...wizard.settings, ...partial } })
  const pauseLabel = WIZARD_PAUSES.find((pause) => pause.ms === wizard.settings.pauseMs)?.label ?? 'Natural'

  // The real tour player with the unsaved steps. Saved English steps play their AI voice clip;
  // edited (or Bangla) steps use the browser voice until saved.
  const liveWizard = useMemo<PublicWizard>(
    () => ({
      slug: wizard.slug,
      name: wizard.name,
      guideName: wizard.guideName || 'Nova',
      businessName: businessName || wizard.name,
      language: wizard.language,
      theme: wizard.theme,
      shape: wizard.shape,
      steps: wizard.steps
        .filter((step) => step.heading.trim() || step.body.trim())
        .map((step) => {
          const text = spokenText(step)
          return { ...step, audioVersion: !isDirty && savedSteps.get(step.id) === text ? textVersion(text) : null }
        }),
      chatUrl: null,
      isPublished: wizard.isPublished,
      settings: wizard.settings,
    }),
    [businessName, isDirty, savedSteps, wizard],
  )

  const live =
    part === 'assistant'
      ? undefined
      : {
          href: publicPath,
          content: liveWizard.steps.length ? (
            <WizardTour wizard={liveWizard} embedded />
          ) : (
            <div
              className={cn('flex h-full flex-col items-center justify-center gap-4 p-6 text-center', palette.isLight ? 'text-zinc-900' : 'text-zinc-50')}
              style={{ backgroundColor: palette.colorBack }}
            >
              <WizardGem theme={wizard.theme} shape={wizard.shape} size={150} />
              <p className="text-sm opacity-70">No steps yet</p>
            </div>
          ),
        }

  return (
    <ServiceStudio
      name={wizard.product ? 'Product tour' : part === 'assistant' ? `${assistantName ?? 'Tour guide'} · Tour` : 'Tour'}
      icon={Compass}
      tagline={part === 'assistant' ? 'What your business tour says, step by step. Colours, shape and publishing live in Services → Tour.' : undefined}
      status={{ live: wizard.isPublished, label: wizard.isPublished ? 'Published' : 'Draft' }}
      toggle={
        part === 'assistant'
          ? undefined
          : {
              label: 'Published',
              checked: wizard.isPublished,
              onChange: togglePublished,
              busy: isPublishing,
              // Product tours play on their share link; the business tour goes on the website.
              requiresWebsite: part === 'service',
            }
      }
      dirty={isDirty}
      saving={isSaving}
      onSave={save}
      sections={SECTIONS[part].length ? SECTIONS[part] : undefined}
      live={live}
      guide={
        part === 'assistant'
          ? undefined
          : { service: 'tour', notice: wizard.isPublished ? null : 'This tour is a draft. Publish it so your site can play it.' }
      }
    >
      {part === 'service' ? (
        <ServiceAssistantPicker service="tour" assistants={assistants} currentId={tourAssistantId} />
      ) : null}

      {showBehaviour ? (
      <StudioSection
        id="basics"
        icon={UserRound}
        title="Basics"
        description="The tour's name, your guide, and the language and voice it narrates in."
        summary={[
          { label: 'guide', value: wizard.guideName || 'Nova' },
          { label: 'language', value: wizard.language === 'bn' ? 'Bangla' : 'English' },
          { label: 'voice', value: wizard.language === 'en' ? voiceLabel : 'browser voice' },
          ...(wizard.product ? [{ label: 'agent', value: wizard.product.agentName ?? 'none yet' }] : []),
        ]}
      >
        {wizard.product ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm">
            <div className="min-w-0 space-y-0.5">
              <p className="truncate">
                <span className="text-muted-foreground">Product:</span> {wizard.product.title}
              </p>
              <p>
                <span className="text-muted-foreground">AI agent:</span>{' '}
                {wizard.product.agentName ?? <span className="text-amber-500">none picked yet</span>}
                <span className="text-xs text-muted-foreground"> · Draft with AI writes from its prompt</span>
              </p>
            </div>
            <Link
              href={`/projects/${wizard.product.id}`}
              className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Change agent in product settings
            </Link>
          </div>
        ) : null}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Tour name" htmlFor="wizard-name" counter={`${wizard.name.length}/${WIZARD_LIMITS.name}`}>
            <Input id="wizard-name" value={wizard.name} maxLength={WIZARD_LIMITS.name} onChange={(e) => patch({ name: e.target.value })} />
          </Field>
          <Field label="Guide name" htmlFor="guide-name">
            <Input
              id="guide-name"
              value={wizard.guideName}
              maxLength={WIZARD_LIMITS.guideName}
              onChange={(e) => patch({ guideName: e.target.value })}
              placeholder="Nova"
            />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Language">
            <Segmented ariaLabel="Language" value={wizard.language} options={WIZARD_LANGUAGES} onChange={(language) => patch({ language })} />
          </Field>
          <Field label="Voice" htmlFor="wizard-voice">
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
                Bangla narration uses the visitor&apos;s browser voice for now. Captions still advance if their device has no
                Bangla voice.
              </p>
            )}
          </Field>
        </div>
      </StudioSection>
      ) : null}

      {showLook ? (
      <StudioSection
        id="look"
        icon={Palette}
        accent="rose"
        title="Look"
      >
        <Field label="Theme">
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(WIZARD_THEMES) as WizardThemeId[]).map((themeId) => (
              <button
                key={themeId}
                type="button"
                role="radio"
                aria-checked={wizard.theme === themeId}
                onClick={() => patch({ theme: themeId })}
                className={cn(
                  'flex items-center gap-2 rounded-xl border p-2 text-sm',
                  wizard.theme === themeId ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/60',
                )}
              >
                <span
                  className="h-7 w-7 rounded-full border border-white/10"
                  style={{ background: `linear-gradient(135deg, ${WIZARD_THEMES[themeId].colors.join(', ')})` }}
                />
                {WIZARD_THEMES[themeId].label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Shape">
          <Segmented ariaLabel="Shape" value={wizard.shape} options={WIZARD_SHAPES} onChange={(shape) => patch({ shape })} />
        </Field>
      </StudioSection>
      ) : null}

      {showBehaviour ? (
      <>
      <StudioSection
        id="playback"
        icon={Waves}
        accent="emerald"
        title="Playback"
        description="How the tour starts, moves between steps and ends."
        summary={[
          { label: 'start', value: wizard.settings.showIntro ? 'intro screen' : 'first step' },
          { label: 'advance', value: wizard.settings.autoAdvance ? `auto · ${pauseLabel}` : 'visitor taps Next' },
          { label: 'progress', value: wizard.settings.showProgress ? 'shown' : 'hidden' },
          { label: 'talk button', value: wizard.settings.showTalkButton ? 'shown' : 'hidden' },
        ]}
      >
        <ToggleRow
          label="Start with the guide's intro"
          hint="Off opens straight on the first step (the share-link panel always does)."
          checked={wizard.settings.showIntro}
          onChange={(showIntro) => patchSettings({ showIntro })}
        />
        <ToggleRow
          label="Move on automatically"
          hint="Off narrates one step at a time; visitors tap Next to hear the next one."
          checked={wizard.settings.autoAdvance}
          onChange={(autoAdvance) => patchSettings({ autoAdvance })}
        />
        {wizard.settings.autoAdvance ? (
          <Field label="Pace between steps">
            <Segmented
              ariaLabel="Pace between steps"
              value={wizard.settings.pauseMs}
              options={WIZARD_PAUSES.map((pause) => ({ id: pause.ms, label: pause.label }))}
              onChange={(pauseMs) => patchSettings({ pauseMs })}
            />
          </Field>
        ) : null}
        <ToggleRow
          label="Show progress"
          hint="The bar of step dots under the captions."
          checked={wizard.settings.showProgress}
          onChange={(showProgress) => patchSettings({ showProgress })}
        />
        <ToggleRow
          label="“Talk to us” at the end"
          hint={wizard.product ? 'Product tours end on Continue to payment instead.' : 'Opens your Chat AI page when it is on.'}
          checked={wizard.settings.showTalkButton}
          onChange={(showTalkButton) => patchSettings({ showTalkButton })}
          disabled={Boolean(wizard.product)}
        />
      </StudioSection>

      <StudioSection
        id="steps"
        icon={Footprints}
        accent="sky"
        title="Tour steps"
        description="Each step is a section of the page. The guide speaks the narration, then moves on."
        summary={[
          { label: 'steps', value: `${wizard.steps.length} of ${WIZARD_LIMITS.maxSteps}` },
          { label: 'voice clips', value: wizard.language === 'en' ? 'pre-recorded on publish' : 'browser voice' },
        ]}
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={draftWithAi} disabled={isDrafting}>
              {isDrafting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
              Draft with AI
            </Button>
            <Button variant="outline" size="sm" onClick={addStep}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add step
            </Button>
          </div>
        }
      >
        {wizard.steps.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            No steps yet. Draft with AI or add one.
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
                selectedStep?.id === step.id ? 'border-primary/60 bg-primary/5' : 'border-border/70 bg-muted/10',
              )}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border font-mono text-[10px] text-muted-foreground">
                  {index + 1}
                </span>
                <span className="truncate text-xs font-medium text-muted-foreground">{step.heading || `Step ${index + 1}`}</span>
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
                aria-label={`Step ${index + 1} heading`}
              />
              <Textarea
                value={step.body}
                maxLength={WIZARD_LIMITS.body}
                onChange={(e) => patchStep(step.id, { body: e.target.value })}
                placeholder="Text shown on the page"
                rows={2}
                aria-label={`Step ${index + 1} text`}
              />
              <div className="space-y-1">
                <Textarea
                  value={step.narration}
                  maxLength={WIZARD_LIMITS.narration}
                  onChange={(e) => patchStep(step.id, { narration: e.target.value })}
                  placeholder="What the guide says (defaults to heading + text)"
                  rows={3}
                  aria-label={`Step ${index + 1} narration`}
                />
                <p className="text-right font-mono text-[10px] text-muted-foreground">
                  {step.narration.length}/{WIZARD_LIMITS.narration}
                </p>
              </div>
              <div className="space-y-1">
                <Input
                  value={step.target}
                  maxLength={WIZARD_LIMITS.target}
                  onChange={(e) => patchStep(step.id, { target: e.target.value })}
                  placeholder="Website section (optional), e.g. pricing"
                  aria-label={`Step ${index + 1} website section`}
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
                  aria-label={`Step ${index + 1} button label`}
                />
                <Input
                  value={step.ctaUrl}
                  maxLength={WIZARD_LIMITS.ctaUrl}
                  onChange={(e) => patchStep(step.id, { ctaUrl: e.target.value })}
                  placeholder="https://… or /chat/your-room"
                  aria-label={`Step ${index + 1} button link`}
                />
              </div>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">
          Publishing pre-records every English line once. Visitors replay the stored clips, so tours don&apos;t add per-visit
          voice costs.
        </p>
      </StudioSection>
      </>
      ) : null}
    </ServiceStudio>
  )
}
