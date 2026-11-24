import type { StsWizard, StsWizardStep } from './types.js'

export type WizardPlayerEvents = {
  onStep?: (step: StsWizardStep, index: number) => void
  onSpeakingChange?: (speaking: boolean) => void
  onEnd?: () => void
}

const ACTIVE_ATTR = 'data-sts-active'
const GAP_BETWEEN_STEPS_MS = 600
/** Follow mode: a section counts as reached once it sits in the middle of the screen this long. */
const DWELL_MS = 600

function readingTimeMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.min(14_000, Math.max(2_500, words * 380))
}

function findTarget(step: StsWizardStep): HTMLElement | null {
  if (!step.target || typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>(`[data-sts-step="${CSS.escape(step.target)}"]`)
}

/**
 * Plays a tour on the creator's own page, marking the active `[data-sts-step]` section with
 * `data-sts-active` (style it however you like). Two ways to run it:
 * - `start()`: the tour leads. It scrolls to each section in turn and narrates it.
 * - `follow()`: the visitor leads. Nothing scrolls; each section's step plays once, when the
 *   visitor scrolls it into the middle of the screen. A step with no target plays at the start.
 * Steps whose target is missing on this page are skipped, so one tour can cover many pages.
 */
export function createWizardPlayer(wizard: StsWizard, events: WizardPlayerEvents = {}) {
  const audio = typeof Audio === 'undefined' ? null : new Audio()
  let runId = 0
  let muted = false
  let cancelCurrent: (() => void) | null = null
  let observer: IntersectionObserver | null = null
  let dwellTimer: ReturnType<typeof setTimeout> | null = null
  const played = new Set<string>()

  let playable = wizard.steps.filter((step) => !step.target || findTarget(step))

  function clearActive() {
    document.querySelectorAll(`[${ACTIVE_ATTR}]`).forEach((el) => el.removeAttribute(ACTIVE_ATTR))
  }

  function wait(ms: number) {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms)
      cancelCurrent = () => {
        clearTimeout(timer)
        resolve()
      }
    })
  }

  function speakWithBrowser(text: string) {
    if (typeof speechSynthesis === 'undefined') return wait(readingTimeMs(text))
    const lang = wizard.language === 'bn' ? 'bn' : 'en'
    const voice = speechSynthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith(lang)) ?? null
    if (lang === 'bn' && !voice) return wait(readingTimeMs(text))
    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = lang === 'bn' ? 'bn-BD' : 'en-US'
      if (voice) utterance.voice = voice
      const guard = setTimeout(resolve, readingTimeMs(text) + 4_000)
      const done = () => {
        clearTimeout(guard)
        resolve()
      }
      utterance.onend = done
      utterance.onerror = done
      cancelCurrent = () => {
        speechSynthesis.cancel()
        done()
      }
      speechSynthesis.speak(utterance)
    })
  }

  function speakWithClip(url: string) {
    return new Promise<boolean>((resolve) => {
      if (!audio) return resolve(false)
      audio.onended = () => resolve(true)
      audio.onerror = () => resolve(false)
      cancelCurrent = () => {
        audio.pause()
        resolve(true)
      }
      audio.src = url
      audio.play().catch(() => resolve(false))
    })
  }

  async function narrate(step: StsWizardStep) {
    if (muted) return wait(readingTimeMs(step.narration))
    if (step.audioUrl && (await speakWithClip(step.audioUrl))) return
    return speakWithBrowser(step.narration)
  }

  async function playFrom(index: number) {
    const id = ++runId
    for (let i = index; i < playable.length; i += 1) {
      const step = playable[i]
      clearActive()
      const target = findTarget(step)
      if (target) {
        target.setAttribute(ACTIVE_ATTR, 'true')
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
      }
      events.onStep?.(step, i)
      events.onSpeakingChange?.(true)
      await narrate(step)
      if (id !== runId) return
      events.onSpeakingChange?.(false)
      await wait(GAP_BETWEEN_STEPS_MS)
      if (id !== runId) return
    }
    clearActive()
    events.onEnd?.()
  }

  function unlockAudio() {
    if (!audio) return
    audio.muted = true
    void audio.play().catch(() => undefined)
    audio.pause()
    audio.muted = false
  }

  function silence() {
    runId += 1
    cancelCurrent?.()
    audio?.pause()
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
  }

  function stopFollowing() {
    observer?.disconnect()
    observer = null
    if (dwellTimer) clearTimeout(dwellTimer)
    dwellTimer = null
  }

  /** Follow mode: plays one step, cutting off whichever step was still talking. */
  async function playOnce(step: StsWizardStep) {
    if (played.has(step.id)) return
    played.add(step.id)
    silence()
    const id = runId
    clearActive()
    findTarget(step)?.setAttribute(ACTIVE_ATTR, 'true')
    events.onStep?.(step, playable.indexOf(step))
    events.onSpeakingChange?.(true)
    await narrate(step)
    if (id !== runId) return
    events.onSpeakingChange?.(false)
    if (playable.every((item) => played.has(item.id))) events.onEnd?.()
  }

  function follow() {
    stopFollowing()
    playable = wizard.steps.filter((step) => !step.target || findTarget(step))
    const byTarget = new Map(playable.filter((step) => step.target).map((step) => [step.target as string, step]))
    const opener = playable.find((step) => !step.target)
    if (opener) void playOnce(opener)
    if (typeof IntersectionObserver === 'undefined') return

    let current: string | null = null
    observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
        if (visible.length === 0) return
        const target = (visible[visible.length - 1].target as HTMLElement).getAttribute('data-sts-step')
        if (!target || target === current) return
        current = target
        if (dwellTimer) clearTimeout(dwellTimer)
        dwellTimer = setTimeout(() => {
          const step = current ? byTarget.get(current) : undefined
          if (step) void playOnce(step)
        }, DWELL_MS)
      },
      // Only the middle fifth of the screen counts, so a section is "reached", not just peeking in.
      { rootMargin: '-40% 0px -40% 0px' },
    )
    byTarget.forEach((_step, target) => {
      const element = document.querySelector(`[data-sts-step="${CSS.escape(target)}"]`)
      if (element) observer?.observe(element)
    })
  }

  return {
    get steps() {
      return playable
    },
    /** The tour leads. Call from a click handler (browsers block audio without a user gesture). */
    start(index = 0) {
      stopFollowing()
      unlockAudio()
      void playFrom(index)
    },
    /**
     * The visitor leads. Call from a click handler the first time so sound is allowed. Call it
     * again after your site changes page without a reload, to pick up that page's sections.
     */
    follow() {
      unlockAudio()
      follow()
    },
    /** Lets every step play again, for example when the visitor restarts the tour. */
    reset() {
      played.clear()
    },
    stop() {
      stopFollowing()
      silence()
      clearActive()
      events.onSpeakingChange?.(false)
    },
    setMuted(value: boolean) {
      muted = value
      if (value) silence()
    },
  }
}

export type WizardPlayer = ReturnType<typeof createWizardPlayer>
