'use client'

import { useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react'
import { useTheme } from 'next-themes'
import { ArrowRight, ArrowUpRight, CalendarDays, Check, Globe, Loader2, MapPin, Video, Volume2, VolumeX, X, type LucideIcon } from 'lucide-react'
import { createMyBusiness } from '@/actions/business'
import { advanceOnboarding, connectStarterKeys, finishOnboarding, getFirstAgentStatus, startFirstAgent } from '@/actions/onboarding'
import { ASSISTANT_SERVICES, ASSISTANT_SERVICE_META, type AssistantService } from '@/lib/agents/assistantServices'
import { VERTICALS } from '@/lib/business/siteContent'
import { describeActionError } from '@/lib/clientActionErrors'
import { guideLine, type GuideLineId } from '@/lib/onboarding/guideLines'
import { PARTNER_PRESETS } from '@/lib/partners/partnerPresets'
import { TONES } from '@/lib/services/types'
import type { FirstAgentBuild } from '@/lib/onboarding/firstAgent'
import { cn } from '@/lib/utils'
import { WARP_CAROUSEL_CARDS, WarpCarousel, type WarpCard } from '@/components/ui/warp-carousel'
import { PartnerLogo } from '../../../(protectedRoutes)/integrations/_components/PartnerLogos'
import { CARD_CHIP, CARD_GHOST, CARD_INPUT, CARD_PRIMARY, PALETTES, StepCard } from './StepCard'
import { useGuideVoice } from './useGuideVoice'

/**
 * One small step per card. The first four come before the workspace exists. The agent is built
 * in the background after "language", so nobody waits on it.
 */
const CARDS = ['keys', 'name', 'type', 'location', 'service', 'tags', 'goals', 'tone', 'language', 'tools', 'leads', 'finish'] as const
export type CardId = (typeof CARDS)[number]

const TITLES: Record<CardId, [string, string]> = {
  keys: ['Connect', 'your AI'],
  name: ['Business', 'name'],
  type: ['Business', 'type'],
  location: ['Business', 'location'],
  service: ['First agent', 'service'],
  tags: ['Find you', 'online'],
  goals: ['What it', 'does'],
  tone: ['How it', 'sounds'],
  language: ['Its', 'language'],
  tools: ['Tools and', 'integrations'],
  leads: ['Find', 'leads'],
  finish: ['All', 'set'],
}

/** Shown on the ring's cards while they spin (the front card's form covers it at rest). */
const RING_FOOTERS: Record<CardId, string> = {
  keys: 'Gemini and Cartesia',
  name: 'Your workspace',
  type: 'Pick one',
  location: 'City, state',
  service: 'Chat, voice, form or tour',
  tags: 'Optional',
  goals: 'Pick any',
  tone: 'Pick one',
  language: 'Pick one',
  tools: 'Connect any time',
  leads: 'Maps, calls, calendar',
  finish: 'Ready',
}

/** The ring's cards: one per step, in the reference's four looks (mesh, numeral, glow, detail). */
const RING_CARDS: WarpCard[] = (() => {
  return CARDS.map((id, i) => {
    const look = WARP_CAROUSEL_CARDS[i % WARP_CAROUSEL_CARDS.length]
    return {
      ...look,
      title: TITLES[id].join('\n'),
      value: String(i + 1).padStart(2, '0'),
      unit: `/${CARDS.length}`,
      footer: RING_FOOTERS[id],
      labels: look.detail === 'slider' ? ['Start', 'Done'] : look.detail === 'cross' ? ['Setup', 'in', 'out'] : look.labels,
    }
  })
})()

/** The 3D ring needs room; phones and short windows get the flat cards. */
const WIDE_QUERY = '(min-width: 1024px) and (min-height: 700px)'
function useWideStage(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(WIDE_QUERY)
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    },
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true,
  )
}

const GOALS = [
  { id: 'answer', label: 'Answer questions' },
  { id: 'leads', label: 'Collect leads' },
  { id: 'book', label: 'Book calls' },
  { id: 'sell', label: 'Sell' },
]
const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'bn', label: 'বাংলা' },
  { id: 'both', label: 'Both' },
] as const
const BUILT_IN_TOOLS = ['Capture leads', 'Email you', 'Read websites', 'Hand off to you']
const LEAD_FEATURES = ['Find on Maps', 'Score calls', 'Sync calendar', 'Enrich websites']
/** Where leads come from: Serper (Maps search), Fathom (call recordings), Google Calendar, website scraping. */
const LEAD_SOURCES: { label: string; Icon: LucideIcon; color: string }[] = [
  { label: 'Google Maps (Serper)', Icon: MapPin, color: 'text-blue-600' },
  { label: 'Fathom', Icon: Video, color: 'text-violet-600' },
  { label: 'Google Calendar', Icon: CalendarDays, color: 'text-emerald-600' },
  { label: 'Website enrichment', Icon: Globe, color: 'text-orange-500' },
]
const MAX_TAGS = 8

const KEY_LINKS = {
  gemini: { label: 'Gemini', placeholder: 'AIza…', href: 'https://aistudio.google.com/apikey', note: 'Free' },
  cartesia: { label: 'Cartesia', placeholder: 'sk_car_…', href: 'https://play.cartesia.ai/keys', note: 'Free tier' },
} as const

type KeyField = keyof typeof KEY_LINKS
const KEY_FIELDS = Object.keys(KEY_LINKS) as KeyField[]

type Props = {
  start: CardId
  businessName: string | null
  savedKeys: Record<KeyField, boolean>
}

export function OnboardingFlow({ start, businessName: initialBusinessName, savedKeys }: Props) {
  const [card, setCard] = useState<CardId>(start)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Card 1
  const [keys, setKeys] = useState<Record<KeyField, string>>({ gemini: '', cartesia: '' })
  const [keyErrors, setKeyErrors] = useState<Partial<Record<KeyField, string>>>({})
  // The wizard speaks with Cartesia.
  const [voiceReady, setVoiceReady] = useState(savedKeys.cartesia)
  // Business
  const [name, setName] = useState(initialBusinessName ?? '')
  const [type, setType] = useState('')
  const [location, setLocation] = useState('')
  // Agent
  const [service, setService] = useState<AssistantService | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [tagText, setTagText] = useState('')
  const [goals, setGoals] = useState<string[]>([])
  const [tone, setTone] = useState<string>('friendly')
  const [language, setLanguage] = useState<'en' | 'bn' | 'both'>('en')
  const [agentBuild, setAgentBuild] = useState<FirstAgentBuild | null>(null)
  /** No build on the server (e.g. setup resumed after a restart): stop checking. */
  const [noBuild, setNoBuild] = useState(false)

  const voice = useGuideVoice(voiceReady)
  const wide = useWideStage()
  const { resolvedTheme } = useTheme()
  const vars = { name: name.trim() || undefined }
  const lineId: GuideLineId | null = card === 'keys' ? null : card
  const index = CARDS.indexOf(card)
  const readyName = agentBuild?.status === 'ready' ? agentBuild.agentName : null

  // The wizard speaks each card's line as it opens.
  const { speak } = voice
  useEffect(() => {
    if (lineId) void speak(lineId, { name: name.trim() || undefined })
    // Only a new card should speak, not every keystroke in a name.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineId, speak])

  // While the agent builds in the background, Tools, Leads and Finish check on it every few seconds.
  const watching = card === 'tools' || card === 'leads' || card === 'finish'
  const building = agentBuild ? agentBuild.status === 'building' : !noBuild
  useEffect(() => {
    if (!watching || !building) return
    let cancelled = false
    const check = async () => {
      const status = await getFirstAgentStatus().catch(() => null)
      if (cancelled) return
      if (status) setAgentBuild(status)
      else setNoBuild(true)
    }
    void check()
    const timer = window.setInterval(check, 3000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [watching, building])

  // The wizard says when the agent lands.
  useEffect(() => {
    if (readyName) void speak('ready', { agent: readyName })
  }, [readyName, speak])

  const go = (next: CardId) => {
    setError(null)
    setCard(next)
  }

  /** Runs a server step with the card's busy state and one inline error. */
  const run = async (task: () => Promise<string | null>) => {
    setPending(true)
    setError(null)
    try {
      const failure = await task()
      if (failure) setError(failure)
    } catch (caught) {
      setError(describeActionError(caught))
    } finally {
      setPending(false)
    }
  }

  const submitKeys = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      setKeyErrors({})
      const result = await connectStarterKeys({ geminiKey: keys.gemini, cartesiaKey: keys.cartesia })
      if (!result.ok) {
        const { form, ...fields } = result.errors
        setKeyErrors(fields)
        return form ?? null
      }
      setVoiceReady(true)
      go('name')
      return null
    })
  }

  const submitBusiness = () =>
    run(async () => {
      const result = await createMyBusiness({ name, type, location })
      if (!result.ok) return result.error
      go('service')
      return null
    })

  const addTags = (text: string) => {
    const next = [...tags]
    for (const tag of text.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean)) {
      if (next.length < MAX_TAGS && !next.includes(tag)) next.push(tag.slice(0, 80))
    }
    setTags(next)
    setTagText('')
    return next
  }

  /** Starts the agent in the background and moves straight on to Tools. */
  const build = () =>
    run(async () => {
      if (!service) return 'Pick a service'
      const finalTags = tagText.trim() ? addTags(tagText) : tags
      const started = await startFirstAgent({ service, tags: finalTags, goals, tone, language })
      if (!started.ok) return started.error
      setAgentBuild({ status: 'building', service, agentName: null, starter: false })
      const moved = await advanceOnboarding('tools')
      if (!moved.ok) return moved.error
      go('tools')
      return null
    })

  const moveTo = (next: 'tools' | 'leads' | 'finish') =>
    run(async () => {
      const result = await advanceOnboarding(next)
      if (!result.ok) return result.error
      go(next)
      return null
    })

  // Saves "done" and redirects to home in the same response.
  const finish = () =>
    run(async () => {
      voice.stop()
      const result = await finishOnboarding()
      return result && !result.ok ? result.error : null
    })

  const agentStatus = agentBuild ? (
      <p className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs text-white/85">
        {agentBuild.status === 'building' ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Building your {ASSISTANT_SERVICE_META[agentBuild.service].noun} in the background
          </>
        ) : agentBuild.status === 'ready' ? (
          <>
            <Check className="h-3.5 w-3.5" />
            {agentBuild.agentName} is ready{agentBuild.starter ? ' with a starter prompt. Edit it in AI Agents.' : '.'}
          </>
        ) : (
          <>Couldn&apos;t build the agent. Create one any time in AI Agents.</>
        )}
      </p>
    ) : null

  const badge =
    card === 'keys' ? null : (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/80">
        <span className={cn('h-1.5 w-1.5 rounded-full bg-white/70', voice.speaking && 'animate-pulse bg-white')} />
        Wizard
      </span>
    )

  const primary = (label: string, onClick?: () => void, disabled?: boolean, submit?: boolean) => (
    <button type={submit ? 'submit' : 'button'} onClick={onClick} disabled={pending || disabled} className={CARD_PRIMARY}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {label}
      {pending ? null : <ArrowRight className="h-4 w-4" />}
    </button>
  )
  const back = (to: CardId) => (
    <button type="button" onClick={() => go(to)} disabled={pending} className={CARD_GHOST}>
      Back
    </button>
  )
  const chips = (items: readonly { id: string; label: string }[], isOn: (id: string) => boolean, toggle: (id: string) => void, compact = false) => (
    <div className={cn('flex flex-wrap', compact ? 'gap-1.5' : 'gap-2')}>
      {items.map((item) => (
        <button key={item.id} type="button" aria-pressed={isOn(item.id)} onClick={() => toggle(item.id)} className={cn(CARD_CHIP, compact && 'px-3 py-1 text-[13px]')}>
          {item.label}
        </button>
      ))}
    </div>
  )

  let body: ReactNode = null
  let footer: ReactNode = null

  switch (card) {
    case 'keys':
      body = (
        <form id="keys-form" onSubmit={submitKeys} className="flex flex-col gap-4">
          {KEY_FIELDS.map((field) => {
            const meta = KEY_LINKS[field]
            return (
              <label key={field} className="flex flex-col gap-1.5">
                <span className="flex items-baseline justify-between text-xs text-white/75">
                  {meta.label}
                  <a href={meta.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-white hover:underline">
                    Get a key · {meta.note}
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
                </span>
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={keys[field]}
                  onChange={(event) => setKeys((current) => ({ ...current, [field]: event.target.value }))}
                  placeholder={savedKeys[field] ? 'Saved. Paste to replace' : meta.placeholder}
                  className={cn(CARD_INPUT, keyErrors[field] && 'border-rose-300/70')}
                />
                {keyErrors[field] ? <span className="text-xs text-rose-200">{keyErrors[field]}</span> : null}
              </label>
            )
          })}
        </form>
      )
      footer = (
        <>
          <span>Change them any time in Config.</span>
          <button type="submit" form="keys-form" disabled={pending} className={CARD_PRIMARY}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {pending ? 'Checking' : 'Connect'}
          </button>
        </>
      )
      break

    case 'name':
      body = (
        <form
          id="name-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (name.trim()) go('type')
          }}
        >
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Business name" maxLength={120} autoFocus className={CARD_INPUT} />
        </form>
      )
      footer = (
        <>
          <span />
          <button type="submit" form="name-form" disabled={!name.trim()} className={CARD_PRIMARY}>
            Next <ArrowRight className="h-4 w-4" />
          </button>
        </>
      )
      break

    case 'type':
      body = chips(VERTICALS, (id) => id === type, setType, true)
      footer = (
        <>
          {back('name')}
          {primary('Next', () => go('location'), !type)}
        </>
      )
      break

    case 'location':
      body = (
        <form
          id="location-form"
          onSubmit={(event) => {
            event.preventDefault()
            void submitBusiness()
          }}
        >
          <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="City, state" maxLength={120} autoFocus className={CARD_INPUT} />
        </form>
      )
      footer = (
        <>
          {back('type')}
          <button type="submit" form="location-form" disabled={pending} className={CARD_PRIMARY}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create my workspace
          </button>
        </>
      )
      break

    case 'service':
      body = (
        <div className="flex flex-col gap-2">
          {ASSISTANT_SERVICES.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={service === id}
              onClick={() => setService(id)}
              className="rounded-xl border border-white/20 px-3.5 py-2.5 text-left transition-colors hover:bg-white/10 aria-pressed:border-white aria-pressed:bg-white aria-pressed:text-black"
            >
              <span className="block text-sm font-medium">{ASSISTANT_SERVICE_META[id].label}</span>
            </button>
          ))}
        </div>
      )
      footer = (
        <>
          <button type="button" onClick={() => void moveTo('tools')} disabled={pending} className={CARD_GHOST}>
            Skip
          </button>
          {primary('Next', () => go('tags'), !service)}
        </>
      )
      break

    case 'tags':
      body = (
        <div
          className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-2.5 py-2 focus-within:border-white/55"
          onClick={(event) => event.currentTarget.querySelector('input')?.focus()}
        >
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-0.5 text-xs">
              {tag}
              <button type="button" aria-label={`Remove ${tag}`} onClick={() => setTags(tags.filter((item) => item !== tag))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            value={tagText}
            autoFocus
            aria-label="Tags"
            autoCapitalize="none"
            spellCheck={false}
            disabled={tags.length >= MAX_TAGS}
            onChange={(event) => (/[\s,]$/.test(event.target.value) ? addTags(event.target.value) : setTagText(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                if (tagText.trim()) addTags(tagText)
                else go('goals')
              } else if (event.key === 'Backspace' && !tagText && tags.length) {
                setTags(tags.slice(0, -1))
              }
            }}
            onBlur={() => tagText.trim() && addTags(tagText)}
            placeholder={tags.length ? '' : '@username  site.com'}
            className="min-w-28 flex-1 bg-transparent py-0.5 text-[15px] outline-none placeholder:text-white/45"
          />
        </div>
      )
      footer = (
        <>
          {back('service')}
          {primary(tags.length || tagText.trim() ? 'Next' : 'Skip', () => {
            if (tagText.trim()) addTags(tagText)
            go('goals')
          })}
        </>
      )
      break

    case 'goals':
      body = chips(GOALS, (id) => goals.includes(id), (id) => setGoals(goals.includes(id) ? goals.filter((item) => item !== id) : [...goals, id]))
      footer = (
        <>
          {back('tags')}
          {primary('Next', () => go('tone'), !goals.length)}
        </>
      )
      break

    case 'tone':
      body = chips(TONES, (id) => id === tone, setTone)
      footer = (
        <>
          {back('goals')}
          {primary('Next', () => go('language'))}
        </>
      )
      break

    case 'language':
      body = chips(LANGUAGES, (id) => id === language, (id) => setLanguage(id as typeof language))
      footer = (
        <>
          {back('tone')}
          {primary('Build agent', () => void build(), !service)}
        </>
      )
      break

    case 'tools':
      body = (
        <div className="flex flex-col gap-4">
          {agentStatus}
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {BUILT_IN_TOOLS.map((tool) => (
              <li key={tool} className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-white/70" />
                {tool}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {PARTNER_PRESETS.map((preset) => (
              <span key={preset.kind} title={preset.label} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white p-2 [&_svg]:h-full [&_svg]:w-full">
                <PartnerLogo kind={preset.kind} />
              </span>
            ))}
          </div>
        </div>
      )
      footer = (
        <>
          <span />
          {primary('Next', () => void moveTo('leads'))}
        </>
      )
      break

    case 'leads':
      body = (
        <div className="flex flex-col gap-4">
          {agentStatus}
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {LEAD_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-white/70" />
                {feature}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {LEAD_SOURCES.map(({ label, Icon, color }) => (
              <span key={label} title={label} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white p-2">
                <Icon className={cn('h-full w-full', color)} aria-hidden="true" />
                <span className="sr-only">{label}</span>
              </span>
            ))}
          </div>
        </div>
      )
      footer = (
        <>
          {back('tools')}
          {primary('Next', () => void moveTo('finish'))}
        </>
      )
      break

    case 'finish':
      body = agentStatus
      footer = (
        <>
          <span />
          {primary('Go to home', () => void finish())}
        </>
      )
      break
  }

  const cardProps = {
    palette: PALETTES[index % PALETTES.length],
    title: TITLES[card],
    step: index + 1,
    total: CARDS.length,
    badge,
    line: card === 'keys' ? 'Two free keys: Gemini thinks, Cartesia listens and speaks.' : lineId ? guideLine(lineId, vars) : undefined,
    footer,
  }
  const content = (
    <>
      {body}
      {error ? <p className="text-xs text-rose-200">{error}</p> : null}
    </>
  )
  const muteButton = voiceReady ? (
    <button
      type="button"
      onClick={() => voice.setMuted(!voice.muted)}
      className="absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
      aria-pressed={voice.muted}
    >
      {voice.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      {voice.muted ? 'Unmute' : 'Mute'}
    </button>
  ) : null

  if (wide) {
    // The steps ride the 3D ring: Next spins it to the next card, whose form appears once it lands.
    return (
      <div className="relative h-dvh w-full">
        {muteButton}
        <WarpCarousel
          cards={RING_CARDS}
          index={index}
          autoplay={false}
          interactive={false}
          spinSeconds={1.6}
          background={resolvedTheme === 'dark' ? '#0b0b0c' : '#f0f0f0'}
          ariaLabel="Setup steps"
          style={{ minHeight: 0, aspectRatio: 'auto' }}
          overlay={
            <StepCard key={card} variant="face" {...cardProps}>
              {content}
            </StepCard>
          }
        />
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-[#f0f0f0] px-4 py-10 text-neutral-900 dark:bg-[#0b0b0c] dark:text-neutral-100">
      {muteButton}
      <StepCard key={card} {...cardProps}>
        {content}
      </StepCard>
    </div>
  )
}
