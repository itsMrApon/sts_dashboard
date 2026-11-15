'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { Check, type LucideIcon } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ACCENTS, type AccentId } from '@/lib/services/types'
import { cn } from '@/lib/utils'

/**
 * Building blocks for the service settings pages (Chat, Speak, Form, Wizard, Business), in the
 * style of the partner integration page: cards with an accent icon, and a mono "summary" panel
 * that shows what the current settings add up to.
 */

export type StudioAccent = 'violet' | 'emerald' | 'amber' | 'rose' | 'sky'

const ACCENT_ICON: Record<StudioAccent, string> = {
  violet: 'text-violet-500 dark:text-violet-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  rose: 'text-rose-500 dark:text-rose-400',
  sky: 'text-sky-600 dark:text-sky-400',
}

const ACCENT_GLOW: Record<StudioAccent, string> = {
  violet: 'hover:shadow-[0_0_30px_-8px_rgba(139,92,246,0.25)]',
  emerald: 'hover:shadow-[0_0_30px_-8px_rgba(52,211,153,0.22)]',
  amber: 'hover:shadow-[0_0_30px_-8px_rgba(251,191,36,0.22)]',
  rose: 'hover:shadow-[0_0_30px_-8px_rgba(251,113,133,0.22)]',
  sky: 'hover:shadow-[0_0_30px_-8px_rgba(56,189,248,0.22)]',
}

export type SummaryLine = { label: string; value: string }

/**
 * card: bordered cards with a summary panel (AI Agents). glass: the borderless showcase look
 * used beside a live page (Services) — soft translucent panels, no summary.
 */
type Surface = 'card' | 'glass'
const SurfaceContext = createContext<Surface>('card')

export function StudioSurface({ value, children }: { value: Surface; children: ReactNode }) {
  return <SurfaceContext.Provider value={value}>{children}</SurfaceContext.Provider>
}

/** One settings card: icon + title + description, the fields, and an optional summary panel. */
export function StudioSection({
  id,
  icon: Icon,
  accent = 'violet',
  title,
  description,
  summary,
  summaryLabel = 'Current',
  action,
  children,
}: {
  id: string
  icon: LucideIcon
  accent?: StudioAccent
  title: string
  description?: string
  summary?: SummaryLine[]
  summaryLabel?: string
  /** Top-right button (e.g. "Draft with AI"). */
  action?: ReactNode
  children: ReactNode
}) {
  const surface = useContext(SurfaceContext)

  if (surface === 'glass') {
    return (
      <section
        id={`studio-${id}`}
        aria-labelledby={`studio-${id}-title`}
        className="scroll-mt-32 space-y-5 rounded-2xl border border-white/5 bg-zinc-900/40 p-6 backdrop-blur-sm"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id={`studio-${id}-title`} className={cn('flex items-center gap-2 text-sm font-medium', ACCENT_ICON[accent])}>
            <Icon className="h-4 w-4" aria-hidden />
            <span className="text-foreground">{title}</span>
          </h2>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        {description ? <p className="-mt-3 text-sm text-muted-foreground">{description}</p> : null}
        <div className="space-y-5">{children}</div>
      </section>
    )
  }

  return (
    <section
      id={`studio-${id}`}
      aria-labelledby={`studio-${id}-title`}
      className={cn(
        '@container scroll-mt-32 overflow-hidden rounded-2xl border border-border/80 bg-card transition-[border-color,box-shadow] duration-300 hover:border-border',
        ACCENT_GLOW[accent],
      )}
    >
      <div className="flex flex-col @3xl:flex-row">
        <div className="min-w-0 flex-1 p-5 sm:p-6">
          <div className={cn('mb-5 flex justify-between gap-3', description ? 'items-start' : 'items-center')}>
            <div className={cn('flex min-w-0 gap-3', description ? 'items-start' : 'items-center')}>
              <span className={cn('shrink-0 rounded-lg border border-border/60 bg-muted/60 p-2', ACCENT_ICON[accent])}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 id={`studio-${id}-title`} className="text-base font-medium leading-tight">
                  {title}
                </h2>
                {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
              </div>
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>
          <div className="space-y-5">{children}</div>
        </div>

        {summary && summary.length ? (
          <aside className="hidden border-l border-border/60 bg-muted/30 @3xl:flex @3xl:w-60 @3xl:flex-col" aria-label={`${title} summary`}>
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{summaryLabel}</span>
              <span className="flex gap-1.5 opacity-60" aria-hidden>
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
              </span>
            </div>
            <dl className="flex-1 space-y-2 p-4 font-mono text-[11px] leading-relaxed">
              {summary.map((line) => (
                <div key={line.label}>
                  <dt className="text-muted-foreground">{line.label}</dt>
                  <dd className={cn('truncate', ACCENT_ICON[accent])} title={line.value}>
                    {line.value || '—'}
                  </dd>
                </div>
              ))}
            </dl>
          </aside>
        ) : null}
      </div>
    </section>
  )
}

/** A labelled field stacked above its control. */
export function Field({
  label,
  htmlFor,
  hint,
  counter,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: ReactNode
  /** e.g. "45/70" */
  counter?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={htmlFor}>{label}</Label>
        {counter ? <span className="font-mono text-[11px] text-muted-foreground">{counter}</span> : null}
      </div>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/** A switch with its label and hint, as one row. */
export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/40',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  )
}

/** A compact one-of-many control (2–4 short options). */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: readonly { id: T; label: string }[]
  onChange: (value: T) => void
  ariaLabel: string
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex max-w-full flex-wrap gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
      {options.map((option) => {
        const selected = option.id === value
        return (
          <button
            key={String(option.id)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.id)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              selected ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** Larger choices with a hint line (tone, layout…). */
export function ChoiceCards<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  columns = 4,
}: {
  value: T
  options: readonly { id: T; label: string; hint?: string }[]
  onChange: (value: T) => void
  ariaLabel: string
  columns?: 2 | 3 | 4
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('grid gap-2', columns === 2 ? 'grid-cols-2' : columns === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4')}
    >
      {options.map((option) => {
        const selected = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.id)}
            className={cn(
              'relative rounded-xl border px-3 py-2.5 text-left transition-colors',
              selected ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50',
            )}
          >
            {selected ? <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-primary" aria-hidden /> : null}
            <span className="block text-sm font-medium">{option.label}</span>
            {option.hint ? <span className="mt-0.5 block text-[11px] text-muted-foreground">{option.hint}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

/** Brand colour swatches. */
export function AccentPicker({ value, onChange }: { value: AccentId; onChange: (value: AccentId) => void }) {
  return (
    <div role="radiogroup" aria-label="Accent colour" className="flex flex-wrap gap-2">
      {ACCENTS.map((accent) => {
        const selected = accent.id === value
        return (
          <button
            key={accent.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={accent.label}
            title={accent.label}
            onClick={() => onChange(accent.id)}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow',
              selected ? 'ring-2 ring-foreground/70' : 'hover:ring-2 hover:ring-border',
            )}
            style={{ backgroundColor: accent.hex }}
          >
            {selected ? <Check className="h-4 w-4 text-white" aria-hidden /> : null}
          </button>
        )
      })}
    </div>
  )
}

/** Editor-style window (traffic-light dots + file pill) around a preview or code. */
export function StudioWindow({
  title,
  actions,
  children,
  className,
}: {
  title: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('group relative', className)}>
      <div aria-hidden className="absolute -inset-0.5 rounded-2xl bg-gradient-to-b from-border to-transparent opacity-40 blur transition duration-700 group-hover:opacity-70" />
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl shadow-black/5">
        <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-muted/40 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex shrink-0 gap-1.5" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
            </span>
            <span className="truncate rounded-md border border-border/70 bg-background/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
              {title}
            </span>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
        </div>
        {children}
      </div>
    </div>
  )
}
