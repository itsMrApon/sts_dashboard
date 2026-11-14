'use client'

import { useState, type ReactNode } from 'react'
import { Code2, ExternalLink, Loader2, Save, SlidersHorizontal, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { StudioIntegrate, type IntegrateProps } from './StudioIntegrate'
import { StudioWindow } from './StudioPrimitives'

type Props = {
  name: string
  icon: LucideIcon
  tagline: string
  /** Status pill next to the name. */
  status: { live: boolean; label: string }
  /** The "on website" switch (Chat, Speak, Form) or "Published" (Wizard). */
  toggle?: { label: string; checked: boolean; onChange: (checked: boolean) => void; busy?: boolean }
  publicHref?: string
  publicLabel?: string
  dirty: boolean
  saving: boolean
  onSave: () => void
  saveLabel?: string
  /** More buttons after Save (e.g. Business → Publish). */
  extraActions?: ReactNode
  /** Jump links above the settings ("On this page"). */
  sections?: { id: string; label: string }[]
  /** Above the settings column (e.g. Business section tabs). */
  settingsHeader?: ReactNode
  children: ReactNode
  preview: ReactNode
  previewTitle: string
  previewActions?: ReactNode
  integrate: IntegrateProps
}

type Tab = 'settings' | 'integrate'

/**
 * The settings page of a website service. A control bar (status, tabs, publish/save), then
 * either the settings with a live preview, or the Integrate walkthrough.
 */
export function ServiceStudio({
  name,
  icon: Icon,
  tagline,
  status,
  toggle,
  publicHref,
  publicLabel = 'Open page',
  dirty,
  saving,
  onSave,
  saveLabel = 'Save',
  extraActions,
  sections,
  settingsHeader,
  children,
  preview,
  previewTitle,
  previewActions,
  integrate,
}: Props) {
  const [tab, setTab] = useState<Tab>('settings')

  const jump = (id: string) =>
    document.getElementById(`studio-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="flex flex-col gap-5">
      {/* Control bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-3 sm:p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/60 text-primary">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">{name}</p>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
                  status.live ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground',
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', status.live ? 'animate-pulse bg-emerald-500' : 'bg-muted-foreground/60')} />
                {status.label}
              </span>
              {dirty ? <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Unsaved changes</span> : null}
            </div>
            <p className="truncate text-xs text-muted-foreground">{tagline}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label={`${name} view`} className="flex rounded-lg border border-border bg-muted/40 p-0.5">
            {(
              [
                { id: 'settings', label: 'Settings', icon: SlidersHorizontal },
                { id: 'integrate', label: 'Integrate', icon: Code2 },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  tab === item.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <item.icon className="h-3.5 w-3.5" aria-hidden />
                {item.label}
              </button>
            ))}
          </div>
          {publicHref ? (
            <a
              href={publicHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted/60"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              {publicLabel}
            </a>
          ) : null}
          {toggle ? (
            <label className="flex h-8 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium">
              {toggle.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              {toggle.label}
              <Switch checked={toggle.checked} onCheckedChange={toggle.onChange} disabled={toggle.busy} />
            </label>
          ) : null}
          <Button size="sm" className="h-8" onClick={onSave} disabled={!dirty || saving} variant={extraActions ? 'outline' : 'default'}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            {saveLabel}
          </Button>
          {extraActions}
        </div>
      </div>

      {tab === 'settings' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="flex min-w-0 flex-col gap-4">
            {settingsHeader}
            {sections && sections.length > 1 ? (
              <nav aria-label="On this page" className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5 scrollbar-hide">
                <span className="shrink-0 pr-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Jump to</span>
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => jump(section.id)}
                    className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                  >
                    {section.label}
                  </button>
                ))}
              </nav>
            ) : null}
            {children}
          </div>
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <StudioWindow title={previewTitle} actions={previewActions}>
              {preview}
            </StudioWindow>
            <p className="mt-2 px-1 text-[11px] text-muted-foreground">Live preview · updates as you type, before you save.</p>
          </aside>
        </div>
      ) : (
        <StudioIntegrate {...integrate} />
      )}
    </div>
  )
}
