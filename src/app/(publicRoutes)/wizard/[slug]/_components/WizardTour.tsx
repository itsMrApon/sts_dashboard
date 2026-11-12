'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, MessageCircle, Pause, Play, RotateCcw, ShoppingBag, Volume2, VolumeX, X } from 'lucide-react'
import { WizardGem } from '@/components/wizard/WizardGem'
import { useWizardNarrator } from '@/components/wizard/useWizardNarrator'
import { cn } from '@/lib/utils'
import { resolveTheme, spokenText, type PublicWizard } from '@/lib/wizard/types'

type Phase = 'intro' | 'touring' | 'done'

const PAUSE_BETWEEN_STEPS_MS = 700

const COPY = {
  en: {
    greeting: (guide: string) => `Oh, hi! I'm ${guide}.`,
    tagline: (business: string) => `I'll walk you through ${business} — it takes about a minute.`,
    start: 'Start tour',
    pressEnter: 'Press return ⏎ to start',
    sound: 'Sound',
    on: 'On',
    off: 'Off',
    skip: 'Skip intro',
    restart: 'Restart tour',
    done: 'Tour complete',
    talk: (business: string) => `Talk to ${business}`,
    draft: 'Draft preview — only you can see this',
  },
  bn: {
    greeting: (guide: string) => `হ্যালো! আমি ${guide}।`,
    tagline: (business: string) => `চলুন ${business} ঘুরে দেখি — মাত্র এক মিনিট লাগবে।`,
    start: 'ট্যুর শুরু করুন',
    pressEnter: 'শুরু করতে ⏎ চাপুন',
    sound: 'সাউন্ড',
    on: 'চালু',
    off: 'বন্ধ',
    skip: 'ইন্ট্রো বাদ দিন',
    restart: 'আবার শুরু',
    done: 'ট্যুর শেষ',
    talk: (business: string) => `${business}-এর সাথে কথা বলুন`,
    draft: 'ড্রাফট প্রিভিউ — শুধু আপনি দেখতে পাচ্ছেন',
  },
} as const

function isExternal(url: string) {
  return /^https?:\/\//i.test(url)
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type WizardTourProps = {
  wizard: PublicWizard
  /** Embedded use (offer page): shows a close button. */
  onClose?: () => void
  /** Embedded use (offer page): replaces "Talk to …" with an order button on the last step. */
  orderAction?: { label: string; onClick: () => void }
}

export function WizardTour({ wizard, onClose, orderAction }: WizardTourProps) {
  const palette = resolveTheme(wizard.theme)
  const copy = COPY[wizard.language]
  const { speak, stop, unlock } = useWizardNarrator(wizard.slug, wizard.language)

  const [phase, setPhase] = useState<Phase>('intro')
  const [activeIndex, setActiveIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [muted, setMuted] = useState(false)

  const runIdRef = useRef(0)
  const mutedRef = useRef(muted)
  mutedRef.current = muted
  const sectionRefs = useRef<(HTMLElement | null)[]>([])

  const scrollToStep = useCallback((index: number) => {
    sectionRefs.current[index]?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'center',
    })
  }, [])

  const playFrom = useCallback(
    async (index: number) => {
      const runId = ++runIdRef.current
      for (let current = index; current < wizard.steps.length; current += 1) {
        setActiveIndex(current)
        setPlaying(true)
        scrollToStep(current)
        setSpeaking(true)
        await speak(wizard.steps[current], { muted: mutedRef.current })
        if (runId !== runIdRef.current) return
        setSpeaking(false)
        await new Promise((resolve) => window.setTimeout(resolve, PAUSE_BETWEEN_STEPS_MS))
        if (runId !== runIdRef.current) return
      }
      setPlaying(false)
      setPhase('done')
    },
    [scrollToStep, speak, wizard.steps],
  )

  const halt = useCallback(() => {
    runIdRef.current += 1
    stop()
    setPlaying(false)
    setSpeaking(false)
  }, [stop])

  const startTour = useCallback(() => {
    unlock()
    setPhase('touring')
    void playFrom(0)
  }, [playFrom, unlock])

  const skipIntro = useCallback(() => {
    unlock()
    setPhase('touring')
  }, [unlock])

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(wizard.steps.length - 1, index))
      if (phase === 'done') setPhase('touring')
      if (playing) {
        void playFrom(clamped)
        return
      }
      setActiveIndex(clamped)
      scrollToStep(clamped)
    },
    [phase, playFrom, playing, scrollToStep, wizard.steps.length],
  )

  const togglePlay = useCallback(() => {
    if (playing) {
      halt()
      return
    }
    unlock()
    if (phase === 'done') setPhase('touring')
    void playFrom(phase === 'done' ? 0 : activeIndex)
  }, [activeIndex, halt, phase, playFrom, playing, unlock])

  const toggleMute = useCallback(() => {
    const nextMuted = !mutedRef.current
    setMuted(nextMuted)
    mutedRef.current = nextMuted
    if (playing) void playFrom(activeIndex)
  }, [activeIndex, playFrom, playing])

  useEffect(() => {
    if (phase !== 'intro') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        startTour()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, startTour])

  const activeStep = wizard.steps[activeIndex]
  const mutedText = palette.isLight ? 'text-zinc-500' : 'text-zinc-400'
  const surface = palette.isLight
    ? 'border-black/10 bg-white/80 text-zinc-900'
    : 'border-white/10 bg-zinc-900/80 text-zinc-50'

  return (
    <div className={cn('relative isolate min-h-screen w-full', palette.isLight ? 'text-zinc-900' : 'text-zinc-50')}>
      {/* Full-viewport theme background (the public layout constrains width with `container`). */}
      <div aria-hidden className="fixed inset-0 -z-10" style={{ backgroundColor: palette.colorBack }} />
      {!wizard.isPublished ? (
        <div className="sticky top-0 z-40 bg-amber-500/90 px-4 py-1.5 text-center text-xs font-medium text-black">
          {copy.draft}
        </div>
      ) : null}

      {phase === 'intro' ? (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-6 text-center"
          style={{ backgroundColor: palette.colorBack }}
        >
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close tour"
              className={cn('absolute right-4 top-4 rounded-full p-2', mutedText)}
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
          <WizardGem theme={wizard.theme} shape={wizard.shape} size={220} />
          <div className="space-y-2">
            <p className="text-2xl font-medium">{copy.greeting(wizard.guideName)}</p>
            <p className={cn('text-base', mutedText)}>{copy.tagline(wizard.businessName)}</p>
          </div>
          <button
            type="button"
            onClick={startTour}
            className={cn(
              'rounded-full px-6 py-3 text-sm font-medium shadow-lg transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2',
              palette.isLight ? 'bg-zinc-900 text-white ring-zinc-900/40' : 'bg-white text-zinc-900 ring-white/40',
            )}
          >
            {copy.start} ⏎
          </button>
          <p className={cn('hidden text-xs sm:block', mutedText)}>{copy.pressEnter}</p>
          <div className="absolute inset-x-0 bottom-6 flex items-center justify-center gap-4 px-4">
            <div className={cn('flex items-center gap-1 rounded-full border p-1 text-xs', surface)}>
              <span className={cn('px-2', mutedText)}>{copy.sound}</span>
              {[false, true].map((isMuted) => (
                <button
                  key={String(isMuted)}
                  type="button"
                  onClick={() => setMuted(isMuted)}
                  aria-pressed={muted === isMuted}
                  className={cn(
                    'rounded-full px-3 py-1',
                    muted === isMuted && (palette.isLight ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-900'),
                  )}
                >
                  {isMuted ? copy.off : copy.on}
                </button>
              ))}
            </div>
            <button type="button" onClick={skipIntro} className={cn('text-xs underline-offset-4 hover:underline', mutedText)}>
              {copy.skip}
            </button>
          </div>
        </div>
      ) : null}

      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-sm font-semibold tracking-tight">{wizard.businessName}</span>
        <button
          type="button"
          onClick={() => {
            unlock()
            setPhase('touring')
            void playFrom(0)
          }}
          className={cn('flex items-center gap-1.5 text-xs', mutedText)}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {copy.restart}
        </button>
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Close tour" className={cn('rounded-full p-2', mutedText)}>
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-48">
        {wizard.steps.map((step, index) => {
          const isActive = index === activeIndex && phase !== 'intro'
          const dimmed = playing && !isActive
          return (
            <section
              key={step.id}
              id={`wizard-step-${step.id}`}
              ref={(node) => {
                sectionRefs.current[index] = node
              }}
              onClick={() => goTo(index)}
              className={cn(
                'flex cursor-pointer flex-col justify-center rounded-3xl border border-transparent px-6 py-16 transition-all duration-500 sm:px-10',
                index === 0 ? 'min-h-[70vh]' : 'min-h-[55vh]',
                dimmed && 'opacity-40',
                isActive && (palette.isLight ? 'border-black/10 bg-black/[0.03]' : 'border-white/10 bg-white/[0.03]'),
              )}
            >
              <span className={cn('mb-4 text-xs font-medium uppercase tracking-[0.2em]', mutedText)}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <h2 className={cn('max-w-3xl font-semibold tracking-tight', index === 0 ? 'text-4xl sm:text-6xl' : 'text-3xl sm:text-4xl')}>
                {step.heading}
              </h2>
              {step.body ? (
                <p className={cn('mt-5 max-w-2xl text-lg leading-relaxed', mutedText)}>{step.body}</p>
              ) : null}
              {step.ctaLabel && step.ctaUrl ? (
                <a
                  href={step.ctaUrl}
                  {...(isExternal(step.ctaUrl) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  onClick={(event) => event.stopPropagation()}
                  className={cn(
                    'mt-8 inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium',
                    palette.isLight ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-900',
                  )}
                >
                  {step.ctaLabel}
                  <ChevronRight className="h-4 w-4" />
                </a>
              ) : null}
            </section>
          )
        })}
      </main>

      {phase !== 'intro' && activeStep ? (
        <aside
          className={cn(
            'fixed inset-x-4 bottom-4 z-40 rounded-3xl border p-4 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[380px]',
            surface,
          )}
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <WizardGem theme={wizard.theme} shape={wizard.shape} size={56} speaking={speaking} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">
                {wizard.guideName}
                {phase === 'done' ? <span className={cn('ml-2 font-normal', mutedText)}>· {copy.done}</span> : null}
              </p>
              <p className={cn('mt-1 line-clamp-4 text-sm leading-snug', mutedText)}>{spokenText(activeStep)}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1.5">
            {wizard.steps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                aria-label={`Step ${index + 1}`}
                onClick={() => goTo(index)}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  index <= activeIndex
                    ? palette.isLight
                      ? 'bg-zinc-900'
                      : 'bg-white'
                    : palette.isLight
                      ? 'bg-black/15'
                      : 'bg-white/15',
                )}
              />
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => goTo(activeIndex - 1)} aria-label="Previous step" className="rounded-full p-2 hover:bg-white/10">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? 'Pause' : 'Play'}
                className={cn('rounded-full p-2.5', palette.isLight ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-900')}
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <button type="button" onClick={() => goTo(activeIndex + 1)} aria-label="Next step" className="rounded-full p-2 hover:bg-white/10">
                <ChevronRight className="h-4 w-4" />
              </button>
              <button type="button" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} className="rounded-full p-2 hover:bg-white/10">
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
            {orderAction && (phase === 'done' || activeIndex === wizard.steps.length - 1) ? (
              <button
                type="button"
                onClick={orderAction.onClick}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium',
                  palette.isLight ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-900',
                )}
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                {orderAction.label}
              </button>
            ) : wizard.chatUrl && !orderAction ? (
              <a
                href={wizard.chatUrl}
                className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs', palette.isLight ? 'border-black/10' : 'border-white/15')}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span className="max-w-[140px] truncate">{copy.talk(wizard.businessName)}</span>
              </a>
            ) : null}
          </div>
        </aside>
      ) : null}
    </div>
  )
}
