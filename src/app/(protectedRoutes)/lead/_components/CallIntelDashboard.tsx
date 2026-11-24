'use client'

import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/lib/toast'
import {
  LeadList,
  type LeadImportBatchOption,
  type LeadListRow,
  type LeadSearchBatchOption,
} from './LeadList'
import {
  LeadCalendar,
  type LeadCalendarMonth,
} from './calendar/LeadCalendar'
import { openLeadIntegration } from './leadIntegrationLinks'
import type { LeadViewMode } from './LeadPageHeaderControls'

const GCAL_RECONNECT_TOAST_KEY = 'sts-gcal-reconnect-toast'

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
  importBatches?: LeadImportBatchOption[]
  calendarMonth?: LeadCalendarMonth | null
  serperConfigured: boolean
  geminiResearchReady: boolean
  googleOAuthConfigured: boolean
  hasGeminiKey: boolean
  /** Which section is open: /lead/calendar or /lead/list. */
  view: LeadViewMode
}

export function CallIntelDashboard(props: CallIntelDashboardProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { view } = props
  // Expired Google Calendar access: one toast per browser session, with a button that goes straight
  // to Google to reconnect (the calendar and list both load this).
  const gcalNeedsReconnect = Boolean(props.setup.gcalNeedsReconnect)
  useEffect(() => {
    if (!gcalNeedsReconnect || searchParams.get('gcal')) return
    try {
      if (sessionStorage.getItem(GCAL_RECONNECT_TOAST_KEY)) return
      sessionStorage.setItem(GCAL_RECONNECT_TOAST_KEY, '1')
    } catch {
      /* storage blocked: show it anyway */
    }
    toast.error('Google Calendar needs reconnecting', {
      id: 'gcal-reconnect',
      description: 'Google stopped letting the app read your calendar.',
      duration: 10000,
      action: {
        label: 'Reconnect',
        onClick: () => window.location.assign('/api/integrations/google-calendar/connect'),
      },
    })
  }, [gcalNeedsReconnect, searchParams])

  useEffect(() => {
    const gcal = searchParams.get('gcal')
    if (!gcal) return
    const messages: Record<string, string> = {
      connected: 'Google Calendar connected.',
      failed: 'Could not connect Google Calendar. Try again.',
      missing_oauth: 'Add your Google OAuth Client ID and secret in Integrations first.',
      no_refresh: 'Google did not return a refresh token. Try Connect again.',
      missing_scope:
        "Google didn't give calendar access. Connect again and tick the calendar box on Google's screen.",
      error: 'Google Calendar authorization was cancelled.',
    }
    const msg =
      messages[gcal] || (gcal === 'missing' ? 'Missing OAuth response.' : null)
    if (msg) {
      if (gcal === 'connected') {
        try {
          sessionStorage.removeItem(GCAL_RECONNECT_TOAST_KEY)
        } catch {
          /* ignore */
        }
        toast.success(msg)
        router.refresh()
      } else {
        toast.error(msg, {
          action: {
            label: 'Google settings',
            onClick: () => openLeadIntegration('google'),
          },
        })
      }
    }
    router.replace(pathname, { scroll: false })
  }, [searchParams, router, pathname])

  const emptyCalendar: LeadCalendarMonth = {
    month: new Date().toISOString().slice(0, 7),
    todayBatch: null,
    activities: [],
    followUps: [],
    latestImport: null,
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
          searchBatches={props.searchBatches}
          importBatches={props.importBatches}
          hasGeminiKey={props.hasGeminiKey}
        />
      )}
    </div>
  )
}
