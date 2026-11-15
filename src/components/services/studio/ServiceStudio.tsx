'use client'

import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { Check, Link2, Loader2, Save, type LucideIcon } from 'lucide-react'
import { AnimatePresence, motion, type Variants } from 'motion/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useWebsiteGate } from '@/components/services/connection/WebsiteConnection'
import { serviceGuide, type GuideService } from '@/lib/services/snippets'
import { cn } from '@/lib/utils'
import { CodeWalkthrough } from './CodeWalkthrough'
import { StudioSurface } from './StudioPrimitives'

type View = 'settings' | 'live' | 'integrate'

type Props = {
  name: string
  icon: LucideIcon
  /** Status pill next to the name. */
  status: { live: boolean; label: string }
  /** "On website" (Chat, Voice, Form) or "Published" (Tour). */
  toggle?: {
    label: string
    checked: boolean
    onChange: (checked: boolean) => void
    busy?: boolean
    /** Switching on needs the website connection (checked once, on the first publish). */
    requiresWebsite?: boolean
  }
  dirty: boolean
  saving: boolean
  onSave: () => void
  saveLabel?: string
  /** More buttons after Save (e.g. Business → Publish). */
  extraActions?: ReactNode
  /** AI Agents only: a line under the name, and jump links above the settings. */
  tagline?: string
  sections?: { id: string; label: string }[]
  /** Above the settings (e.g. Business section tabs). */
  settingsHeader?: ReactNode
  children: ReactNode
  /** The hosted page, live, with the unsaved settings. Omitted in AI Agents. */
  live?: {
    /** Hosted path, e.g. /chat/<room>: copied by the link button. */
    href: string
    content: ReactNode
    actions?: ReactNode
  }
  /** Where this service goes on the creator's website. Omitted in AI Agents. */
  guide?: { service: GuideService; notice?: string | null }
}

/** Per side: settings keeps the live page left (blue), integrate moves it right (emerald). */
const SIDE = {
  settings: {
    gradient: 'from-blue-600 to-indigo-900',
    glow: 'bg-blue-500',
    ring: 'border-l-blue-500/50',
    background: 'radial-gradient(circle at 0% 50%, rgba(59, 130, 246, 0.15), transparent 50%)',
  },
  integrate: {
    gradient: 'from-emerald-600 to-teal-900',
    glow: 'bg-emerald-500',
    ring: 'border-r-emerald-500/50',
    background: 'radial-gradient(circle at 100% 50%, rgba(16, 185, 129, 0.15), transparent 50%)',
  },
} as const

const ANIMATIONS = {
  container: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
    exit: { opacity: 0, transition: { duration: 0.2 } },
  } satisfies Variants,
  item: {
    hidden: { opacity: 0, y: 20, filter: 'blur(10px)' },
    visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 100, damping: 20 } },
    exit: { opacity: 0, y: -10, filter: 'blur(5px)' },
  } satisfies Variants,
}

/** window.location.origin after mount ('' during SSR, so markup matches on hydration). */
function useAppOrigin(): string {
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])
  return origin
}

/** Links in the live view open in a new tab, so unsaved edits here are never lost. */
function keepLinksOutside(event: MouseEvent<HTMLDivElement>) {
  const anchor = (event.target as HTMLElement).closest('a')
  if (!anchor?.href) return
  event.preventDefault()
  window.open(anchor.href, '_blank', 'noopener,noreferrer')
}

/** The live page on its round stage: spinning ring, pulsing glow, gentle float. */
function LiveStage({ live, side, origin }: { live: NonNullable<Props['live']>; side: keyof typeof SIDE; origin: string }) {
  const colors = SIDE[side]
  const [copied, setCopied] = useState(false)
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${origin}${live.href}`)
      setCopied(true)
      toast.success('Link copied')
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy')
    }
  }

  return (
    <div className="relative flex w-full items-center justify-center py-10 lg:py-14">
      {/* Round stage behind the page */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 sm:h-[460px] sm:w-[460px] xl:h-[520px] xl:w-[520px]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className={cn('absolute inset-[-12%] rounded-full border border-dashed border-white/10', colors.ring)}
        />
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className={cn('absolute inset-0 rounded-full bg-gradient-to-br opacity-40 blur-2xl', colors.gradient)}
        />
        <div className="absolute inset-0 rounded-full border border-white/5 bg-black/20 shadow-2xl backdrop-blur-sm" />
      </div>

      {/* The live page, floating in front */}
      <motion.div
        animate={{ y: [-6, 6, -6] }}
        transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
        className="relative z-10 h-[580px] w-full max-w-[400px] overflow-hidden rounded-[2rem] border border-white/5 bg-black/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-sm"
        onClickCapture={keepLinksOutside}
      >
        {live.content}
      </motion.div>

      {/* Status label */}
      <div className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap">
        <div className="flex items-center gap-2 rounded-full border border-white/5 bg-zinc-950/80 py-1 pl-4 pr-1 text-xs uppercase tracking-widest text-zinc-500 backdrop-blur">
          <span className={cn('h-1.5 w-1.5 animate-pulse rounded-full', colors.glow)} />
          Live
          <span className="flex items-center">
            {live.actions}
            <button
              type="button"
              onClick={() => void copyLink()}
              aria-label="Copy page link"
              title="Copy page link"
              className="rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Link2 className="h-3.5 w-3.5" />}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}

/** Floating island at the bottom centre: Settings ⇄ Integrate (plus Live on phones). */
function Switcher({ view, onChange, hasGuide }: { view: View; onChange: (view: View) => void; hasGuide: boolean }) {
  const options: { id: View; label: string; mobileOnly?: boolean }[] = [
    { id: 'settings', label: 'Settings' },
    { id: 'live', label: 'Live', mobileOnly: true },
    ...(hasGuide ? [{ id: 'integrate' as const, label: 'Integrate' }] : []),
  ]

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center lg:bottom-8">
      <motion.div
        layout
        role="tablist"
        aria-label="View"
        className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-zinc-900/80 p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/5 backdrop-blur-2xl"
      >
        {options.map((option) => {
          const active = view === option.id
          return (
            <motion.button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(option.id)}
              whileTap={{ scale: 0.96 }}
              className={cn(
                'relative flex h-12 w-24 items-center justify-center rounded-full text-sm font-medium focus:outline-none',
                option.mobileOnly && 'lg:hidden',
              )}
            >
              {active ? (
                <motion.div
                  layoutId="studio-island-surface"
                  className="absolute inset-0 rounded-full bg-gradient-to-b from-white/10 to-white/5 shadow-inner"
                  transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                />
              ) : null}
              <span className={cn('relative z-10 transition-colors duration-300', active ? 'text-white' : 'text-zinc-500 hover:text-zinc-300')}>
                {option.label}
              </span>
              {active ? (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute -bottom-1 h-1 w-6 rounded-full bg-gradient-to-r from-transparent via-white/60 to-transparent"
                />
              ) : null}
            </motion.button>
          )
        })}
      </motion.div>
    </div>
  )
}

/**
 * A website service's page, laid out like a product showcase: the live page on a round stage,
 * its settings beside it. Integrate swaps sides — the live page slides right and the service's
 * code guide takes the left. AI Agents (no live page) gets a plain bar + settings.
 */
export function ServiceStudio({
  name,
  icon: Icon,
  status,
  toggle,
  dirty,
  saving,
  onSave,
  saveLabel = 'Save',
  extraActions,
  tagline,
  sections,
  settingsHeader,
  children,
  live,
  guide,
}: Props) {
  const [view, setView] = useState<View>('settings')
  const requireWebsite = useWebsiteGate()
  const origin = useAppOrigin()
  const panel = view === 'integrate' && guide ? 'integrate' : 'settings'
  const isLeft = panel === 'settings'

  const onToggle = (next: boolean) => {
    if (!toggle) return
    if (next && toggle.requiresWebsite) requireWebsite(() => toggle.onChange(true))
    else toggle.onChange(next)
  }

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      {toggle ? (
        <label className="flex h-8 items-center gap-2 rounded-full bg-muted/40 px-3 text-xs font-medium">
          {toggle.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          {toggle.label}
          <Switch checked={toggle.checked} onCheckedChange={onToggle} disabled={toggle.busy} />
        </label>
      ) : null}
      <Button size="sm" className="h-8 rounded-full" onClick={onSave} disabled={!dirty || saving} variant={extraActions ? 'outline' : 'default'}>
        {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
        {saveLabel}
      </Button>
      {extraActions}
    </div>
  )

  const statusLine = (
    <span className="inline-flex items-center gap-2">
      {name}
      <span className={cn('h-1.5 w-1.5 rounded-full', status.live ? 'animate-pulse bg-emerald-500' : 'bg-zinc-600')} />
      {status.label}
      {dirty ? <span className="normal-case tracking-normal text-amber-500">· unsaved</span> : null}
    </span>
  )

  const settings = (
    <div className="flex min-w-0 flex-col gap-4">
      {settingsHeader}
      {sections && sections.length > 1 ? (
        <nav aria-label="On this page" className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5 scrollbar-hide">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() =>
                document.getElementById(`studio-${section.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              {section.label}
            </button>
          ))}
        </nav>
      ) : null}
      {children}
    </div>
  )

  // AI Agents: no live page, so a plain control bar above the settings.
  if (!live) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/60 text-primary">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold uppercase tracking-widest text-muted-foreground">{statusLine}</p>
              {tagline ? <p className="truncate text-xs text-muted-foreground">{tagline}</p> : null}
            </div>
          </div>
          {controls}
        </div>
        {settings}
      </div>
    )
  }

  const colors = SIDE[panel]

  return (
    <div className="relative pb-32">
      {/* Background glow that follows the live page */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <motion.div
          animate={{ background: colors.background }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0"
        />
      </div>

      <motion.div
        layout
        transition={{ type: 'spring', bounce: 0, duration: 0.9 }}
        className={cn(
          'relative z-10 flex w-full flex-col items-center gap-10 lg:items-start lg:gap-12 xl:gap-20',
          isLeft ? 'lg:flex-row' : 'lg:flex-row-reverse',
        )}
      >
        {/* Live page */}
        <motion.div
          layout="position"
          className={cn('w-full lg:sticky lg:top-20 lg:w-[46%] lg:shrink-0', view !== 'live' && 'hidden lg:block')}
        >
          <LiveStage live={live} side={panel} origin={origin} />
        </motion.div>

        {/* Settings or Integrate */}
        <motion.div layout="position" className={cn('w-full min-w-0 flex-1 lg:pt-6', view === 'live' && 'hidden lg:block')}>
          <AnimatePresence mode="wait">
            <motion.div
              key={panel}
              variants={ANIMATIONS.container}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex flex-col gap-6"
            >
              <div className={cn('flex flex-col gap-3', isLeft ? 'items-start text-left' : 'items-start text-left lg:items-end lg:text-right')}>
                <motion.h2 variants={ANIMATIONS.item} className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-500">
                  {statusLine}
                </motion.h2>
                <motion.h1
                  variants={ANIMATIONS.item}
                  className="bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-5xl"
                >
                  {panel === 'integrate' ? 'Integrate' : 'Settings'}
                </motion.h1>
                <motion.div variants={ANIMATIONS.item}>{controls}</motion.div>
              </div>

              <motion.div variants={ANIMATIONS.item}>
                {panel === 'integrate' && guide ? (
                  <CodeWalkthrough steps={serviceGuide(guide.service, `${origin}${live.href}`)} notice={guide.notice} />
                ) : (
                  <StudioSurface value="glass">{settings}</StudioSurface>
                )}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </motion.div>

      <Switcher view={view} onChange={setView} hasGuide={Boolean(guide)} />
    </div>
  )
}
