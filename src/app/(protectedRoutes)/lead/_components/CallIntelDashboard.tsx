'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  LeadList,
  type LeadListRow,
  type LeadSearchBatchOption,
} from './LeadList'
import {
  LeadCalendar,
  type LeadCalendarMonth,
} from './calendar/LeadCalendar'
import {
  LEAD_VIEW_KEY,
  type LeadViewMode,
} from './LeadPageHeaderControls'

type AgentOption = { id: string; name: string }

export type CallIntelDashboardProps = {
  connections: Array<{ provider: 'FATHOM' | 'GOOGLE_CALENDAR'; status: string }>
  settings: {
    defaultAgentId: string | null
    selectedWebinarIds: string[]
    calendarFilterMode: 'ALL' | 'KEYWORD'
    calendarKeyword: string | null
    hasUserGoogleOAuth: boolean
    hasUserSerperKey: boolean
    businessLocation: string | null
    businessNiche: string | null
    setupCompletedAt: string | null
  } | null
  setup: {
    complete: boolean
    fathomOk: boolean
    gcalOk: boolean
    gcalNeedsReconnect?: boolean
    agentOk: boolean
    projectsOk: boolean
  }
  agents: AgentOption[]
  leads: LeadListRow[]
  searchBatches?: LeadSearchBatchOption[]
  calendarMonth?: LeadCalendarMonth | null
  serperConfigured: boolean
  geminiResearchReady: boolean
  googleOAuthConfigured: boolean
  hasGeminiKey: boolean
}

export function CallIntelDashboard(props: CallIntelDashboardProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [view, setView] = useState<LeadViewMode>('calendar')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LEAD_VIEW_KEY)
      if (saved === 'list' || saved === 'calendar') setView(saved)
    } catch {
      /* ignore */
    }
    const onView = (e: Event) => {
      const next = (e as CustomEvent<LeadViewMode>).detail
      if (next === 'list' || next === 'calendar') setView(next)
    }
    window.addEventListener('sts-lead-view', onView)
    return () => window.removeEventListener('sts-lead-view', onView)
  }, [])

  useEffect(() => {
    const gcal = searchParams.get('gcal')
    if (!gcal) return
    const messages: Record<string, string> = {
      connected: 'Google Calendar connected.',
      failed: 'Could not connect Google Calendar. Try again.',
      missing_oauth: 'Add Google OAuth Client ID & Secret in Settings first.',
      no_refresh: 'Google did not return a refresh token. Try Connect again.',
      error: 'Google Calendar authorization was cancelled.',
    }
    const msg =
      messages[gcal] || (gcal === 'missing' ? 'Missing OAuth response.' : null)
    if (msg) {
      if (gcal === 'connected') {
        toast.success(msg)
        router.refresh()
      } else {
        toast.error(msg, {
          action: {
            label: 'Settings',
            onClick: () => router.push('/settings'),
          },
        })
      }
    }
    router.replace('/lead', { scroll: false })
  }, [searchParams, router])

  const emptyCalendar: LeadCalendarMonth = {
    month: new Date().toISOString().slice(0, 7),
    todayBatch: null,
    activities: [],
    followUps: [],
    fathomMeetings: [],
    googleEvents: [],
  }

  return (
    <div className="h-full min-h-0 overflow-hidden">
      {view === 'calendar' ? (
        <LeadCalendar
          calendarMonth={props.calendarMonth || emptyCalendar}
          gcalOk={props.setup.gcalOk && !props.setup.gcalNeedsReconnect}
        />
      ) : (
        <LeadList
          leads={props.leads}
          agents={props.agents}
          searchBatches={props.searchBatches}
          hasGeminiKey={props.hasGeminiKey}
          gcalNeedsReconnect={Boolean(props.setup.gcalNeedsReconnect)}
          googleOAuthConfigured={props.googleOAuthConfigured}
          serperConfigured={props.serperConfigured}
          businessLocation={props.settings?.businessLocation ?? null}
          businessNiche={props.settings?.businessNiche ?? null}
        />
      )}
    </div>
  )
}
