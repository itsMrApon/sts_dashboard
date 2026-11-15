'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  Building2,
  CalendarDays,
  ChevronRight,
  FileAudio,
  RefreshCw,
  Search,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FindLeadsDialog } from './FindLeadsDialog'
import { openLeadSettings } from './leadSettingsEvents'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  saveBusinessLeadPrefs,
  setLeadOutboundStatus,
  syncBusinessLeads,
  syncRecentFathomMeetings,
} from '@/actions/callIntel'
import { cn } from '@/lib/utils'
import type { MeetingScoreDetail } from '@/lib/leads/scoreTypes'
import { guardAction } from '@/lib/clientActionErrors'

export type OutboundStatus = 'NEW' | 'ON_PROCESS' | 'DONE'

export type LeadSearchBatchOption = {
  id: string
  location: string
  niche: string
  source: string
  createdAt: string
  leadCount: number
}

export type LeadListRow = {
  id: string
  name: string
  email: string
  emailIsSynthetic: boolean
  company: string | null
  notes: string | null
  phone?: string | null
  website?: string | null
  address?: string | null
  selectedAgentId: string | null
  lastAppointmentAt: string | null
  updatedAt: string
  nextFollowUpAt?: string | null
  kind: 'Instant' | 'Calendar' | 'Business'
  outboundStatus: OutboundStatus
  searchBatchId?: string | null
  searchBatch?: {
    id: string
    createdAt: string
    location: string
    niche: string
  } | null
  hasResearch: boolean
  meeting: {
    id: string
    summary: string | null
    recordedAt: string
    fathomUrl: string | null
    score: MeetingScoreDetail | null
  } | null
}

type Props = {
  leads: LeadListRow[]
  agents: Array<{ id: string; name: string }>
  searchBatches?: LeadSearchBatchOption[]
  hasGeminiKey: boolean
  gcalNeedsReconnect?: boolean
  googleOAuthConfigured?: boolean
  serperConfigured?: boolean
  businessLocation?: string | null
  businessNiche?: string | null
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function batchLabel(batch: LeadSearchBatchOption): string {
  const d = new Date(batch.createdAt)
  const today = new Date()
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startBatch = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round(
    (startToday.getTime() - startBatch.getTime()) / 86_400_000,
  )
  if (diffDays <= 0) return `Today · ${batch.niche} in ${batch.location}`
  if (diffDays === 1) return `Yesterday · ${batch.niche}`
  return `${diffDays}d ago · ${batch.niche}`
}

const OUTBOUND_STYLES: Record<OutboundStatus, string> = {
  NEW: 'bg-sky-600/10 text-sky-700 dark:text-sky-300',
  ON_PROCESS: 'bg-amber-600/10 text-amber-700 dark:text-amber-300',
  DONE: 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-300',
}

const OUTBOUND_LABEL: Record<OutboundStatus, string> = {
  NEW: 'new',
  ON_PROCESS: 'in progress',
  DONE: 'done',
}

const KIND_ICON = { Instant: FileAudio, Business: Building2, Calendar: CalendarDays } as const

/** What happens next with this lead, in a few words. */
function nextStep(lead: LeadListRow): string {
  if (lead.nextFollowUpAt) return `Follow up ${format(new Date(lead.nextFollowUpAt), 'MMM d')}`
  if (lead.lastAppointmentAt) return `Met ${format(new Date(lead.lastAppointmentAt), 'MMM d')}`
  return `Added ${format(new Date(lead.updatedAt), 'MMM d')}`
}

function leadSubtitle(lead: LeadListRow): string {
  if (lead.kind === 'Business') return lead.address || lead.company || 'Business prospect'
  return lead.emailIsSynthetic ? 'Name-only lead (no guest email)' : lead.email
}

/** Desktop column template; phones use a two-column row (lead | status). */
const ROW_GRID =
  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 md:grid-cols-[minmax(0,1fr)_7rem_7.5rem_8.5rem_2rem]'

export function LeadList(props: Props) {
  const router = useRouter()
  const [textSearch, setTextSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<
    'ALL' | 'Instant' | 'Calendar' | 'Business'
  >('ALL')
  const [batchFilter, setBatchFilter] = useState<string>('TODAY')
  const [outboundFilter, setOutboundFilter] = useState<
    'ALL' | OutboundStatus
  >('ALL')
  // Rows keep their natural height inside a scrolling list (the old layout stretched a fixed
  // number of rows into whatever height was left, which clipped them on shorter screens).
  const rowsPerPage = 10
  const [page, setPage] = useState(1)
  const [pending, startTransition] = useTransition()
  const [searchOpen, setSearchOpen] = useState(false)
  const [businessLocation, setBusinessLocation] = useState(
    props.businessLocation || '',
  )
  const [businessNiche, setBusinessNiche] = useState(props.businessNiche || '')
  const [savedBusinessLocation, setSavedBusinessLocation] = useState(
    props.businessLocation || '',
  )
  const [savedBusinessNiche, setSavedBusinessNiche] = useState(
    props.businessNiche || '',
  )

  useEffect(() => {
    setSavedBusinessLocation(props.businessLocation || '')
    setSavedBusinessNiche(props.businessNiche || '')
    setBusinessLocation(props.businessLocation || '')
    setBusinessNiche(props.businessNiche || '')
  }, [props.businessLocation, props.businessNiche])

  const batches = props.searchBatches || []
  const todayBatchId = batches[0]?.id || null

  const hasBusinessPrefs = Boolean(
    savedBusinessLocation.trim() && savedBusinessNiche.trim(),
  )

  const filtered = useMemo(() => {
    const q = textSearch.trim().toLowerCase()
    return props.leads.filter((lead) => {
      if (kindFilter !== 'ALL' && lead.kind !== kindFilter) return false
      if (outboundFilter !== 'ALL' && lead.outboundStatus !== outboundFilter) {
        return false
      }

      if (batchFilter === 'TODAY') {
        if (lead.kind === 'Business') {
          if (!todayBatchId || lead.searchBatchId !== todayBatchId) return false
        }
      } else if (batchFilter !== 'ALL') {
        if (lead.searchBatchId !== batchFilter) return false
      }

      if (!q) return true
      return (
        lead.name.toLowerCase().includes(q) ||
        lead.email.toLowerCase().includes(q) ||
        (lead.company || '').toLowerCase().includes(q) ||
        (lead.address || '').toLowerCase().includes(q)
      )
    })
  }, [
    props.leads,
    textSearch,
    kindFilter,
    outboundFilter,
    batchFilter,
    todayBatchId,
  ])

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))
  const currentPage = Math.min(page, totalPages)
  const showingFrom =
    filtered.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1
  const showingTo = Math.min(currentPage * rowsPerPage, filtered.length)
  const pageRows = filtered.slice(showingFrom - 1, showingTo)

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    okMsg: string,
  ) {
    startTransition(guardAction(async () => {
      try {
        const res = await action()
        if (res.ok) toast.success(okMsg)
        else toast.error(res.error || 'Failed')
      } catch {
        toast.error('Connection lost. Check your internet and try again.')
      }
    }))
  }

  function syncBusiness() {
    if (!props.serperConfigured) {
      toast.error('Serper API key missing — add it in Lead settings', {
        action: {
          label: 'Lead settings',
          onClick: openLeadSettings,
        },
      })
      return
    }
    if (!hasBusinessPrefs) {
      setSearchOpen(true)
      toast.error('Set location and type in Find first')
      return
    }
    startTransition(guardAction(async () => {
      try {
        const res = await syncBusinessLeads()
        if (res.ok) {
          const count = res.data?.count ?? 0
          const created = res.data?.created ?? 0
          toast.success(
            `Business · ${created} new / ${count} in batch (scrape on open)`,
          )
          setBatchFilter('TODAY')
          router.refresh()
        } else toast.error(res.error || 'Failed')
      } catch {
        toast.error('Connection lost. Check your internet and try again.')
      }
    }))
  }

  function saveSearchAndPull() {
    startTransition(guardAction(async () => {
      try {
        const saved = await saveBusinessLeadPrefs({
          location: businessLocation,
          niche: businessNiche,
        })
        if (!saved.ok) {
          toast.error(saved.error || 'Failed to save search')
          return
        }
        setSavedBusinessLocation(businessLocation.trim())
        setSavedBusinessNiche(businessNiche.trim())
        setSearchOpen(false)

        if (!props.serperConfigured) {
          toast.success('Find prefs saved', {
            description: 'Add a Serper key in Lead settings to pull leads.',
            action: {
              label: 'Lead settings',
              onClick: openLeadSettings,
            },
          })
          router.refresh()
          return
        }

        const res = await syncBusinessLeads()
        if (res.ok) {
          toast.success(
            `Pulled ${res.data?.count ?? 0} leads (websites scrape when you open a lead)`,
          )
          setBatchFilter('TODAY')
          router.refresh()
        } else toast.error(res.error || 'Failed')
      } catch {
        toast.error('Connection lost. Check your internet and try again.')
      }
    }))
  }

  function cycleOutbound(lead: LeadListRow) {
    const order: OutboundStatus[] = ['NEW', 'ON_PROCESS', 'DONE']
    const next = order[(order.indexOf(lead.outboundStatus) + 1) % order.length]!
    startTransition(guardAction(async () => {
      const res = await setLeadOutboundStatus(lead.id, next)
      if (res.ok) {
        toast.success(`Marked ${OUTBOUND_LABEL[next]}`)
        router.refresh()
      } else toast.error(res.error || 'Failed')
    }))
  }

  return (
    // Scrolls as a whole on short screens so the toolbar never squeezes the rows away.
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      {!props.hasGeminiKey ? (
        <Card className="shrink-0 border-amber-500/40 bg-amber-500/5 p-4 shadow-none">
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-sm text-amber-800 dark:text-amber-300">
              Add a Gemini key in Config Agent to score summaries and run
              research.
            </p>
            <Button asChild size="sm">
              <Link href="/ai-agents/config">Open Config Agent</Link>
            </Button>
          </div>
        </Card>
      ) : null}

      {props.gcalNeedsReconnect ? (
        <Card className="shrink-0 border-amber-500/40 bg-amber-500/5 p-4 shadow-none">
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-sm text-amber-800 dark:text-amber-300">
              Google Calendar access expired or was revoked. Reconnect it in Lead settings.
            </p>
            <Button size="sm" variant="secondary" onClick={openLeadSettings}>
              Open Lead settings
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="flex flex-1 flex-col gap-0 overflow-hidden rounded-none border-0 bg-transparent py-0 shadow-none sm:rounded-xl sm:border sm:bg-card">
        {/* Toolbar: filters in one row; actions; name filter. */}
        <div className="flex shrink-0 flex-col gap-3 border-b pb-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,1.15fr)] gap-2 sm:flex sm:flex-wrap">
              <Select
                value={kindFilter}
                onValueChange={(v) => {
                  setKindFilter(v as typeof kindFilter)
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-9 w-full min-w-0 px-2.5 text-xs sm:px-3 sm:w-[130px] sm:text-sm" aria-label="Lead type">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All types</SelectItem>
                  <SelectItem value="Calendar">Calendar</SelectItem>
                  <SelectItem value="Instant">Instant</SelectItem>
                  <SelectItem value="Business">Business</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={batchFilter}
                onValueChange={(v) => {
                  setBatchFilter(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-9 w-full min-w-0 px-2.5 text-xs sm:px-3 sm:w-[190px] sm:text-sm" aria-label="Lead batch">
                  <SelectValue placeholder="Batch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAY">Today</SelectItem>
                  <SelectItem value="ALL">All batches</SelectItem>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {batchLabel(b)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={outboundFilter}
                onValueChange={(v) => {
                  setOutboundFilter(v as typeof outboundFilter)
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-9 w-full min-w-0 px-2.5 text-xs sm:px-3 sm:w-[140px] sm:text-sm" aria-label="Outreach status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Any status</SelectItem>
                  <SelectItem value="NEW">New</SelectItem>
                  <SelectItem value="ON_PROCESS">In progress</SelectItem>
                  <SelectItem value="DONE">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Phones: three equal buttons in one row. sm+: natural widths. */}
            <div className="grid grid-cols-3 items-center gap-2 sm:flex">
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                className="px-2 sm:px-3"
                title="Pull recent meetings from Fathom"
                onClick={() => run(() => syncRecentFathomMeetings(), 'Fathom synced')}
              >
                <RefreshCw className="hidden h-4 w-4 sm:block" />
                Meetings
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                className="px-2 sm:px-3"
                title="Pull a new batch of business leads"
                onClick={syncBusiness}
              >
                <RefreshCw className="hidden h-4 w-4 sm:block" />
                Business
              </Button>
              <Button
                size="sm"
                disabled={pending}
                className="bg-white px-2 text-black hover:bg-white/90 sm:px-3 dark:bg-white dark:text-black dark:hover:bg-white/90"
                onClick={() => {
                  setBusinessLocation(props.businessLocation || '')
                  setBusinessNiche(props.businessNiche || '')
                  setSearchOpen(true)
                }}
              >
                <Search className="h-4 w-4" />
                Find
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={textSearch}
                onChange={(e) => {
                  setTextSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Filter by name, email or address…"
                className="h-9 pl-9"
                aria-label="Filter leads"
              />
            </div>
            <p className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {filtered.length} {filtered.length === 1 ? 'lead' : 'leads'}
            </p>
          </div>
        </div>

        {/* Column titles (desktop). */}
        <div
          className={cn(
            ROW_GRID,
            'text-muted-foreground hidden shrink-0 border-b px-4 py-2 text-xs font-medium uppercase tracking-wide sm:px-6 md:grid',
          )}
        >
          <span>Lead</span>
          <span>Type</span>
          <span>Status</span>
          <span>Next step</span>
          <span className="sr-only">Open</span>
        </div>

        <div className="min-h-[140px] flex-1 overflow-y-auto">
          {pageRows.length === 0 ? (
            <div className="text-muted-foreground flex h-full min-h-[200px] flex-col items-center justify-center gap-1 px-6 text-center text-sm">
              <p className="text-foreground font-medium">No leads in this view</p>
              <p>Use Find or Business for a new batch, or sync Meetings from Fathom.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {pageRows.map((lead) => {
                const KindIcon = KIND_ICON[lead.kind]
                return (
                  <li key={lead.id} className={cn(ROW_GRID, 'hover:bg-muted/40 py-3 transition-colors sm:px-6')}>
                    <Link href={`/lead/${lead.id}`} className="flex min-w-0 items-center gap-3">
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback>{initials(lead.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{lead.name}</div>
                        <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
                          {/* Type and next step move into the subtitle on phones. */}
                          <KindIcon className="size-3.5 shrink-0 md:hidden" aria-label={lead.kind} />
                          <span className="truncate">{leadSubtitle(lead)}</span>
                        </div>
                        <div className="text-muted-foreground truncate text-[11px] md:hidden">{nextStep(lead)}</div>
                      </div>
                    </Link>

                    <div className="text-muted-foreground hidden min-w-0 items-center gap-2 text-sm md:flex">
                      <KindIcon className="size-4 shrink-0" />
                      <span className="truncate">{lead.kind}</span>
                    </div>

                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => cycleOutbound(lead)}
                      className="justify-self-end md:justify-self-start"
                      title="Change status: new → in progress → done"
                      aria-label={`Status ${OUTBOUND_LABEL[lead.outboundStatus]}, change`}
                    >
                      <Badge
                        variant="secondary"
                        className={cn('border-0 font-normal capitalize', OUTBOUND_STYLES[lead.outboundStatus])}
                      >
                        {OUTBOUND_LABEL[lead.outboundStatus]}
                      </Badge>
                    </button>

                    <span className="text-muted-foreground hidden truncate text-sm md:block">{nextStep(lead)}</span>

                    <Link
                      href={`/lead/${lead.id}`}
                      aria-label={`Open ${lead.name}`}
                      className="text-muted-foreground hover:text-foreground hidden h-8 w-8 items-center justify-center rounded-md md:flex"
                    >
                      <ChevronRight className="size-4" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t py-3 sm:px-6">
          <p className="text-muted-foreground text-xs sm:text-sm">
            {filtered.length === 0 ? 'No entries' : `${showingFrom}–${showingTo} of ${filtered.length}`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-sm tabular-nums">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      <FindLeadsDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        location={businessLocation}
        niche={businessNiche}
        onLocationChange={setBusinessLocation}
        onNicheChange={setBusinessNiche}
        recentSearches={(props.searchBatches || []).map((b) => ({
          location: b.location,
          niche: b.niche,
        }))}
        serperConfigured={props.serperConfigured}
        pending={pending}
        onSubmit={saveSearchAndPull}
      />
    </div>
  )
}
