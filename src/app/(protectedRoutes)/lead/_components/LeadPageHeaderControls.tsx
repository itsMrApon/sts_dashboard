'use client'

import { Settings2 } from 'lucide-react'
import { SakugaTabs } from '@/components/sakuga/SakugaTabs'
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
  /** Phones: a smaller tab bar. */
  compact?: boolean
}) {
  return (
    <SakugaTabs
      label="Lead view"
      value={value}
      onChange={(next) => onChange(next as LeadViewMode)}
      options={[
        { value: 'calendar', label: 'Calendar' },
        { value: 'list', label: 'List' },
      ]}
      className={compact ? '!mt-1 [zoom:0.8]' : '!mt-1'}
    />
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
