'use client'

import { CalendarDays, List } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export const LEAD_VIEW_KEY = 'sts-lead-view'
export type LeadViewMode = 'calendar' | 'list'

export function LeadViewToggle({
  value,
  onChange,
}: {
  value: LeadViewMode
  onChange: (view: LeadViewMode) => void
}) {
  return (
    <div className="inline-flex rounded-lg border p-1">
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
          value === 'calendar'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
        onClick={() => onChange('calendar')}
      >
        <CalendarDays className="size-4" />
        Calendar
      </button>
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
          value === 'list'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
        onClick={() => onChange('list')}
      >
        <List className="size-4" />
        List
      </button>
    </div>
  )
}

/** PageHeader children — same slot projects uses for TabsList. */
export function LeadPageHeaderControls() {
  const [view, setView] = useState<LeadViewMode>('calendar')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LEAD_VIEW_KEY)
      if (saved === 'list' || saved === 'calendar') setView(saved)
    } catch {
      /* ignore */
    }
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

  return <LeadViewToggle value={view} onChange={change} />
}
