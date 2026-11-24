'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ClipboardList, Compass, CreditCard, MessageCircle, Mic, Volume2, VolumeX, X } from 'lucide-react'
import { submitHostedForm } from '@/actions/publicServices'
import { FormFlow } from '@/components/services/form/FormFlow'
import { useWizardNarrator } from '@/components/wizard/useWizardNarrator'
import type { ChatServiceConfig, FormServiceConfig, SpeakServiceConfig } from '@/lib/services/types'
import { spokenText, type PublicWizard, type PublicWizardStep } from '@/lib/wizard/types'
import { cn } from '@/lib/utils'
import { ChatRoom } from '../../../chat/[roomName]/_components/ChatRoom'
import { SpeakRoom } from '../../../speak/[roomName]/_components/SpeakRoom'
import type { SocialAccountInput } from '../../../speak/[roomName]/_lib/humanContacts'

type PanelKind = 'chat' | 'talk' | 'form'

export type BusinessRoomPanels = {
  chat: { agentName: string; config: ChatServiceConfig; isOwner: boolean } | null
  talk: { agentName: string; firstMessage: string; config: SpeakServiceConfig } | null
  form: { config: FormServiceConfig; defaultCountry: string } | null
}

type Props = {
  roomName: string
  businessName: string
  tagline: string | null
  accent: string
  tour: PublicWizard | null
  panels: BusinessRoomPanels
  socialAccounts: SocialAccountInput[]
  /** Straight-to-payment link of the featured offer, when it has one. */
  payHref: string | null
  /** The business site, rendered on the server. Its sections carry `data-sts-step`. */
  children: ReactNode
}

type SoundChoice = 'on' | 'off'
/** What the visitor chose last time: sound on, captions only, or no tour. */
type SavedChoice = SoundChoice | 'skip'

/** A section counts as "reached" once it sits in the middle of the screen for this long. */
const DWELL_MS = 600

const PANEL_HASHES: Record<string, PanelKind> = { chat: 'chat', talk: 'talk', form: 'form' }

function storageKey(roomName: string) {
  return `sts-room-sound:${roomName}`
}

function readSoundChoice(roomName: string): SavedChoice | null {
  try {
    const value = window.localStorage.getItem(storageKey(roomName))
    return value === 'on' || value === 'off' || value === 'skip' ? value : null
  } catch {
    return null
  }
}

function saveSoundChoice(roomName: string, choice: SavedChoice) {
  try {
    window.localStorage.setItem(storageKey(roomName), choice)
  } catch {
    // Private windows can refuse storage; the intro simply shows again next visit.
  }
}

/**
 * Pairs tour steps with the page's sections. A step whose `target` names a section on this page
 * goes there; the rest fill the remaining sections in page order, so tours written before
 * targets existed still follow the visitor down the page.
 */
function assignSteps(steps: PublicWizardStep[], sections: string[]): Map<string, PublicWizardStep> {
  const bySection = new Map<string, PublicWizardStep>()
  const unplaced: PublicWizardStep[] = []
  for (const step of steps) {
    const target = step.target.trim()
    if (target && sections.includes(target) && !bySection.has(target)) bySection.set(target, step)
    else unplaced.push(step)
  }
  for (const section of sections) {
    if (bySection.has(section)) continue
    const next = unplaced.shift()
    if (!next) break
    bySection.set(section, next)
  }
  return bySection
}

/**
 * The business page as one room: an intro card asks once to start with sound on or off, then
 * each section speaks its tour line when the visitor scrolls to it. Chat, Talk, Book a call and
 * Pay now stay in reach in a bar at the bottom.
 */
export function BusinessRoom({ roomName, businessName, tagline, accent, tour, panels, socialAccounts, payHref, children }: Props) {
  const hasTour = Boolean(tour && tour.steps.length > 0)
  const [introOpen, setIntroOpen] = useState(false)
  const [soundChoice, setSoundChoice] = useState<SoundChoice>('on')
  const [touring, setTouring] = useState(false)
  /** Returning visitor with sound on: audio still needs one tap this visit (browser rule). */
  const [needsTap, setNeedsTap] = useState(false)
  const [panel, setPanel] = useState<PanelKind | null>(null)
  const [caption, setCaption] = useState<{ stepId: string; heading: string; text: string } | null>(null)
  /** A question to send as soon as the chat opens ("Ask about this", an answer's "Ask more"). */
  const [autoAsk, setAutoAsk] = useState<string | null>(null)
  /** The link's `?src=` tag (instagram, flyer…), kept for this visit and sent with the form. */
  const [cameFrom, setCameFrom] = useState<string | null>(null)

  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('src')
      if (fromUrl) window.sessionStorage.setItem('sts-src', fromUrl.slice(0, 32))
      setCameFrom(fromUrl?.slice(0, 32) ?? window.sessionStorage.getItem('sts-src'))
    } catch {
      setCameFrom(new URLSearchParams(window.location.search).get('src'))
    }
  }, [])

  const { speak, stop, unlock } = useWizardNarrator(tour?.slug ?? '', tour?.language ?? 'en')
  const playedRef = useRef(new Set<string>())
  const stepsRef = useRef(new Map<string, PublicWizardStep>())
  const currentSectionRef = useRef<string | null>(null)
  const mutedRef = useRef(false)
  mutedRef.current = soundChoice === 'off' || needsTap
  const pausedRef = useRef(false)
  pausedRef.current = panel !== null

  // First visit: show the intro. Returning: remember the choice and skip it.
  useEffect(() => {
    if (!hasTour) return
    const saved = readSoundChoice(roomName)
    if (!saved) {
      setIntroOpen(true)
      return
    }
    if (saved === 'skip') return
    setSoundChoice(saved)
    setNeedsTap(saved === 'on')
    setTouring(true)
  }, [hasTour, roomName])

  const openPanel = useCallback((kind: PanelKind) => {
    setPanel(kind)
    window.history.replaceState(null, '', `#${kind}`)
  }, [])

  const closePanel = useCallback(() => {
    setPanel(null)
    setAutoAsk(null)
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [])

  // #chat, #talk, #form open a panel (old /chat, /speak, /form links land here); #tour shows the intro.
  useEffect(() => {
    const fromHash = () => {
      const hash = window.location.hash.replace(/^#/, '')
      if (hash.startsWith('ask=') && panels.chat) {
        let question = ''
        try {
          question = decodeURIComponent(hash.slice(4))
        } catch {
          question = ''
        }
        setAutoAsk(question.trim().slice(0, 300) || null)
        setPanel('chat')
        window.history.replaceState(null, '', '#chat')
        return
      }
      const kind = PANEL_HASHES[hash]
      if (kind && panels[kind]) setPanel(kind)
      else if (hash === 'tour' && hasTour) setIntroOpen(true)
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [hasTour, panels])

  const playSection = useCallback(
    (section: string) => {
      const step = stepsRef.current.get(section)
      if (!step || playedRef.current.has(step.id) || pausedRef.current) return
      playedRef.current.add(step.id)
      setCaption({ stepId: step.id, heading: step.heading, text: spokenText(step) })
      void speak(step, { muted: mutedRef.current }).then(() => {
        setCaption((current) => (current?.stepId === step.id ? null : current))
      })
    },
    [speak],
  )

  // Watch the tagged sections; the one in the middle band of the screen is "reached".
  useEffect(() => {
    if (!touring || !tour) return
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-sts-step]'))
    const sections = elements.map((element) => element.dataset.stsStep ?? '').filter(Boolean)
    stepsRef.current = assignSteps(tour.steps, sections)

    let dwell: number | null = null
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
        if (visible.length === 0) return
        const section = (visible[visible.length - 1].target as HTMLElement).dataset.stsStep ?? null
        if (!section || section === currentSectionRef.current) return
        currentSectionRef.current = section
        if (dwell) window.clearTimeout(dwell)
        dwell = window.setTimeout(() => {
          if (currentSectionRef.current === section) playSection(section)
        }, DWELL_MS)
      },
      { rootMargin: '-40% 0px -40% 0px' },
    )
    elements.forEach((element) => observer.observe(element))
    return () => {
      if (dwell) window.clearTimeout(dwell)
      observer.disconnect()
    }
  }, [touring, tour, playSection])

  // At the top of the page the first section may sit above the middle band: play it on start.
  useEffect(() => {
    if (!touring) return
    const timer = window.setTimeout(() => {
      if (window.scrollY > 80) return
      const first = document.querySelector<HTMLElement>('[data-sts-step]')?.dataset.stsStep
      if (first) {
        currentSectionRef.current = first
        playSection(first)
      }
    }, DWELL_MS)
    return () => window.clearTimeout(timer)
  }, [touring, playSection])

  // Returning visitor with sound on: the first tap anywhere turns the voice on.
  useEffect(() => {
    if (!needsTap) return
    const unlockOnce = () => {
      unlock()
      setNeedsTap(false)
    }
    window.addEventListener('pointerdown', unlockOnce, { once: true })
    window.addEventListener('keydown', unlockOnce, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlockOnce)
      window.removeEventListener('keydown', unlockOnce)
    }
  }, [needsTap, unlock])

  // Opening Chat, Talk or the form stops the narration so the two never talk over each other.
  useEffect(() => {
    if (panel) {
      stop()
      setCaption(null)
    }
  }, [panel, stop])

  const start = useCallback(() => {
    if (soundChoice === 'on') unlock()
    saveSoundChoice(roomName, soundChoice)
    setNeedsTap(false)
    setIntroOpen(false)
    playedRef.current.clear()
    currentSectionRef.current = null
    setTouring(false)
    window.requestAnimationFrame(() => setTouring(true))
  }, [unlock, roomName, soundChoice])

  const toggleSound = useCallback(() => {
    const next: SoundChoice = soundChoice === 'on' ? 'off' : 'on'
    if (next === 'on') unlock()
    else stop()
    setSoundChoice(next)
    setNeedsTap(false)
    saveSoundChoice(roomName, next)
  }, [unlock, stop, roomName, soundChoice])

  const actions = useMemo(
    () =>
      [
        panels.chat ? { kind: 'chat' as const, label: 'Chat', icon: MessageCircle } : null,
        panels.talk ? { kind: 'talk' as const, label: 'Talk', icon: Mic } : null,
        panels.form ? { kind: 'form' as const, label: 'Book a call', icon: ClipboardList } : null,
      ].filter((item): item is NonNullable<typeof item> => item !== null),
    [panels],
  )
  const showDock = !introOpen && (actions.length > 0 || payHref || hasTour)

  return (
    <>
      {children}

      {/* Room for the bar so it never covers the footer. */}
      {showDock ? <div aria-hidden className="h-24" /> : null}

      {introOpen ? (
        <RoomIntro
          businessName={businessName}
          tagline={tagline}
          accent={accent}
          soundChoice={soundChoice}
          onSoundChoice={setSoundChoice}
          onStart={start}
          onSkip={() => {
            setIntroOpen(false)
            saveSoundChoice(roomName, 'skip')
          }}
        />
      ) : null}

      {caption && !panel ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-24 z-30 mx-auto max-w-md rounded-2xl border border-white/10 bg-black/70 px-4 py-3 text-sm text-zinc-100 shadow-2xl shadow-black/50 backdrop-blur sm:bottom-28"
        >
          {caption.heading ? <p className="mb-0.5 text-xs font-medium uppercase tracking-[0.14em]" style={{ color: accent }}>{caption.heading}</p> : null}
          <p className="text-pretty leading-relaxed">{caption.text}</p>
        </div>
      ) : null}

      {needsTap && !introOpen ? (
        <button
          type="button"
          onClick={() => undefined}
          className="fixed right-4 top-4 z-30 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-xs text-zinc-200 backdrop-blur"
        >
          <Volume2 className="h-3.5 w-3.5" aria-hidden />
          Tap for sound
        </button>
      ) : null}

      {showDock ? (
        <nav
          aria-label={`Talk to ${businessName}`}
          className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))]"
        >
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-[#0b0c18]/85 p-1.5 shadow-2xl shadow-black/60 backdrop-blur">
            {actions.map((action) => (
              <button
                key={action.kind}
                type="button"
                onClick={() => (panel === action.kind ? closePanel() : openPanel(action.kind))}
                aria-pressed={panel === action.kind}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm transition-colors',
                  panel === action.kind ? 'bg-white text-black' : 'text-zinc-200 hover:bg-white/10',
                )}
              >
                <action.icon className="h-4 w-4" aria-hidden />
                {action.label}
              </button>
            ))}
            {payHref ? (
              <a
                href={payHref}
                style={{ backgroundColor: accent }}
                className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                <CreditCard className="h-4 w-4" aria-hidden />
                Pay now
              </a>
            ) : null}
            {hasTour ? (
              <span className="ml-1 flex shrink-0 items-center gap-0.5 border-l border-white/10 pl-1">
                <button
                  type="button"
                  onClick={() => setIntroOpen(true)}
                  aria-label="Start the tour again"
                  title="Start the tour again"
                  className="rounded-full p-2 text-zinc-300 hover:bg-white/10 hover:text-white"
                >
                  <Compass className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={toggleSound}
                  aria-label={soundChoice === 'on' ? 'Turn the tour voice off' : 'Turn the tour voice on'}
                  title={soundChoice === 'on' ? 'Voice on' : 'Voice off'}
                  className="rounded-full p-2 text-zinc-300 hover:bg-white/10 hover:text-white"
                >
                  {soundChoice === 'on' ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
                </button>
              </span>
            ) : null}
          </div>
        </nav>
      ) : null}

      {panel ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={panel === 'chat' ? 'Chat' : panel === 'talk' ? 'Talk' : 'Book a call'}
          className="fixed inset-x-0 bottom-0 z-40 max-h-[88dvh] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#05060f] p-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-2xl shadow-black/70 sm:inset-x-auto sm:bottom-24 sm:right-6 sm:w-[420px] sm:rounded-3xl"
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-sm font-medium text-zinc-200">
              {panel === 'chat' ? 'Chat' : panel === 'talk' ? 'Talk' : 'Book a call'}
            </p>
            <button
              type="button"
              onClick={closePanel}
              aria-label="Close"
              className="rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {panel === 'chat' && panels.chat ? (
            <ChatRoom
              roomName={roomName}
              agentName={panels.chat.agentName}
              config={panels.chat.config}
              isOwner={panels.chat.isOwner}
              socialAccounts={socialAccounts}
              autoAsk={autoAsk}
            />
          ) : null}
          {panel === 'talk' && panels.talk ? (
            <SpeakRoom
              roomName={roomName}
              agentName={panels.talk.agentName}
              businessName={businessName}
              firstMessage={panels.talk.firstMessage}
              config={panels.talk.config}
              socialAccounts={socialAccounts}
            />
          ) : null}
          {panel === 'form' && panels.form ? (
            <div className="h-[min(600px,78dvh)] overflow-hidden rounded-2xl">
              <FormFlow
                frame="embedded"
                config={panels.form.config}
                defaultCountry={panels.form.defaultCountry}
                chatHref={panels.chat ? '#chat' : undefined}
                onSubmit={(values, consent) => submitHostedForm({ roomName, values, consent, src: cameFrom })}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

type RoomIntroProps = {
  businessName: string
  tagline: string | null
  accent: string
  soundChoice: SoundChoice
  onSoundChoice: (choice: SoundChoice) => void
  onStart: () => void
  onSkip: () => void
}

/** First-visit card: start the room with sound on or off. Enter starts it too. */
function RoomIntro({ businessName, tagline, accent, soundChoice, onSoundChoice, onStart, onSkip }: RoomIntroProps) {
  const startRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    startRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        onStart()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onStart])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="room-intro-title"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#05060f]/92 px-4 backdrop-blur-md"
    >
      <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/60">
        <div className="relative px-6 pb-6 pt-7">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-40 blur-3xl"
            style={{ backgroundColor: accent }}
          />
          <span
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-semibold text-white"
            style={{ backgroundColor: accent }}
          >
            {businessName.trim().charAt(0).toUpperCase() || 'S'}
          </span>
          <h1 id="room-intro-title" className="relative mt-5 text-balance text-2xl font-semibold tracking-tight text-white">
            Welcome to {businessName}
          </h1>
          {tagline ? <p className="relative mt-2 text-pretty text-sm leading-relaxed text-zinc-300">{tagline}</p> : null}
          <p className="relative mt-4 text-xs text-zinc-400">A short voice tour plays as you scroll. Best with sound on.</p>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/30 px-4 py-3">
          <p className="hidden items-center gap-1.5 text-sm text-zinc-400 sm:flex">
            Press
            <kbd className="rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-xs text-zinc-200">Enter</kbd>
            to start
          </p>
          <button
            ref={startRef}
            type="button"
            onClick={onStart}
            style={{ backgroundColor: accent }}
            className="ml-auto rounded-full px-5 py-2 text-sm font-medium text-white outline-offset-4 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            Start
          </button>
        </div>
      </div>

      <div role="radiogroup" aria-label="Sound" className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1 text-sm">
        <span className="flex items-center gap-1.5 px-3 text-zinc-400">
          <Volume2 className="h-4 w-4" aria-hidden />
          Sound
        </span>
        {(['on', 'off'] as const).map((choice) => (
          <button
            key={choice}
            type="button"
            role="radio"
            aria-checked={soundChoice === choice}
            onClick={() => onSoundChoice(choice)}
            className={cn(
              'rounded-full px-4 py-1.5 capitalize transition-colors',
              soundChoice === choice ? 'bg-white text-black' : 'text-zinc-400 hover:text-white',
            )}
          >
            {choice}
          </button>
        ))}
      </div>

      <button type="button" onClick={onSkip} className="text-xs text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline">
        Skip the tour
      </button>
    </div>
  )
}
