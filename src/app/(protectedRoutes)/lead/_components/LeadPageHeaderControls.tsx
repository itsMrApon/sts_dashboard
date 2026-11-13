'use client'

import { CalendarDays, List, Settings2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { openLeadSettings } from './leadSettingsEvents'

export const LEAD_VIEW_KEY = 'sts-lead-view'
export type LeadViewMode = 'calendar' | 'list'

export function LeadViewToggle({
  value,
  onChange,
  compact = false,
}: {
  value: LeadViewMode
  onChange: (view: LeadViewMode) => void
  /** Phones: smaller buttons that fit beside the page title. */
  compact?: boolean
}) {
  const size = compact ? 'gap-1 px-2.5 py-1 text-xs' : 'gap-1.5 px-3 py-1.5 text-sm'
  return (
    <div className="inline-flex rounded-lg border p-1" role="group" aria-label="Lead view">
      <button
        type="button"
        className={cn(
          'inline-flex items-center rounded-md transition-colors',
          size,
          value === 'calendar'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
        aria-pressed={value === 'calendar'}
        onClick={() => onChange('calendar')}
      >
        <CalendarDays className="size-4" />
        Calendar
      </button>
      <button
        type="button"
        className={cn(
          'inline-flex items-center rounded-md transition-colors',
          size,
          value === 'list'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
        aria-pressed={value === 'list'}
        onClick={() => onChange('list')}
      >
        <List className="size-4" />
        List
      </button>
    </div>
  )
}

/** PageHeader children — same slot projects uses for TabsList. */
export function LeadPageHeaderControls({ compact = false }: { compact?: boolean }) {
  const [view, setView] = useState<LeadViewMode>('calendar')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LEAD_VIEW_KEY)
      if (saved === 'list' || saved === 'calendar') setView(saved)
    } catch {
      /* ignore */
    }
    // The page renders this twice (phone title row + desktop search row); keep both in sync.
    const onView = (e: Event) => {
      const next = (e as CustomEvent<LeadViewMode>).detail
      if (next === 'list' || next === 'calendar') setView(next)
    }
    window.addEventListener('sts-lead-view', onView)
    return () => window.removeEventListener('sts-lead-view', onView)
  }, [])

  function change(next: LeadViewMode) {
    setView(next)
    try {
      localStorage.setItem(LEAD_VIEW_KEY, next)
    } catch {
      /* ignore */
    }
    window.dispatchEvent(
      new CustomEvent('sts-lead-view', { detail: next }),
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <LeadViewToggle value={view} onChange={change} compact={compact} />
      <button
        type="button"
        onClick={openLeadSettings}
        aria-label="Lead settings"
        title="Lead settings: Fathom, Google Calendar, Serper"
        className={cn(
          'text-muted-foreground hover:text-foreground inline-flex items-center justify-center rounded-lg border transition-colors hover:bg-muted/50',
          compact ? 'h-8 w-8' : 'h-10 w-10',
        )}
      >
        <Settings2 className="size-4" />
      </button>
    </div>
  )
}
