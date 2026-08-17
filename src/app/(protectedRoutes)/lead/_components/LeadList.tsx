'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Building2,
  CalendarDays,
  Eye,
  FileAudio,
  RefreshCw,
  Search,
  Settings2,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FindLeadsDialog } from './FindLeadsDialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  saveBusinessLeadPrefs,
  setLeadOutboundStatus,
  syncBusinessLeads,
  syncRecentFathomMeetings,
} from '@/actions/callIntel'
import { cn } from '@/lib/utils'
import type { MeetingScoreDetail } from '@/lib/leads/scoreTypes'

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

function batchLabel(batch: LeadSearchBatchOption, index: number): string {
  const d = new Date(batch.createdAt)
  const today = new Date()
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startBatch = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round(
    (startToday.getTime() - startBatch.getTime()) / 86_400_000,
  )
  if (diffDays <= 0) return `Today · ${batch.niche} in ${batch.location}`
  if (diffDays === 1) return `Yesterday · ${batch.leadCount} leads`
  return `${diffDays} days ago · ${batch.leadCount} leads`
}

const OUTBOUND_STYLES: Record<OutboundStatus, string> = {
  NEW: 'bg-sky-600/10 text-sky-700 dark:text-sky-300',
  ON_PROCESS: 'bg-amber-600/10 text-amber-700 dark:text-amber-300',
  DONE: 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-300',
}

const OUTBOUND_LABEL: Record<OutboundStatus, string> = {
  NEW: 'new',
  ON_PROCESS: 'on process',
  DONE: 'done',
}

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
  const rowsPerPage = 5
  const [page, setPage] = useState(1)
  const [pending, startTransition] = useTransition()
  const [searchOpen, setSearchOpen] = useState(false)
  const rowsViewportRef = useRef<HTMLDivElement>(null)
  const [rowHeightPx, setRowHeightPx] = useState(64)
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

  useLayoutEffect(() => {
    const el = rowsViewportRef.current
    if (!el) return

    const HEADER_PX = 56 // h-14 table header
    const syncRowHeight = () => {
      const next = Math.floor((el.clientHeight - HEADER_PX) / rowsPerPage)
      if (next > 0) setRowHeightPx(next)
    }

    syncRowHeight()
    const observer = new ResizeObserver(syncRowHeight)
    observer.observe(el)
    return () => observer.disconnect()
  }, [rowsPerPage])

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
    startTransition(async () => {
      try {
        const res = await action()
        if (res.ok) toast.success(okMsg)
        else toast.error(res.error || 'Failed')
      } catch {
        toast.error('Connection lost. Check your internet and try again.')
      }
    })
  }

  function syncBusiness() {
    if (!props.serperConfigured) {
      toast.error('Serper API key missing — add it in Settings', {
        action: {
          label: 'Settings',
          onClick: () => router.push('/settings'),
        },
      })
      return
    }
    if (!hasBusinessPrefs) {
      setSearchOpen(true)
      toast.error('Set location and type in Find first')
      return
    }
    startTransition(async () => {
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
    })
  }

  function saveSearchAndPull() {
    startTransition(async () => {
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
            description: 'Add a Serper key in Settings to pull leads.',
            action: {
              label: 'Settings',
              onClick: () => router.push('/settings'),
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
    })
  }

  function cycleOutbound(lead: LeadListRow) {
    const order: OutboundStatus[] = ['NEW', 'ON_PROCESS', 'DONE']
    const next = order[(order.indexOf(lead.outboundStatus) + 1) % order.length]!
    startTransition(async () => {
      const res = await setLeadOutboundStatus(lead.id, next)
      if (res.ok) {
        toast.success(`Marked ${OUTBOUND_LABEL[next]}`)
        router.refresh()
      } else toast.error(res.error || 'Failed')
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
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
              Google Calendar access expired or was revoked. Reconnect in
              Settings.
            </p>
            <Button asChild size="sm" variant="secondary">
              <Link href="/settings">Open Settings</Link>
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0 shadow-none">
        <div className="flex shrink-0 flex-wrap gap-3 border-b p-4 sm:items-center sm:justify-between sm:p-6">
          <div className="flex flex-wrap gap-2">
            <Select
              value={kindFilter}
              onValueChange={(v) => {
                setKindFilter(v as typeof kindFilter)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Kind" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All kinds</SelectItem>
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
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Search history" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAY">Today&apos;s 10 leads</SelectItem>
                <SelectItem value="ALL">All batches</SelectItem>
                {batches.map((b, i) => (
                  <SelectItem key={b.id} value={b.id}>
                    {batchLabel(b, i)}
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
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Outbound" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All outbound</SelectItem>
                <SelectItem value="NEW">new</SelectItem>
                <SelectItem value="ON_PROCESS">on process</SelectItem>
                <SelectItem value="DONE">done</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() => syncRecentFathomMeetings(), 'Fathom synced')
              }
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              Meeting
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={syncBusiness}
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              Business
            </Button>
            <Button
              size="sm"
              disabled={pending}
              className="bg-white text-black hover:bg-white/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
              onClick={() => {
                setBusinessLocation(props.businessLocation || '')
                setBusinessNiche(props.businessNiche || '')
                setSearchOpen(true)
              }}
            >
              <Search className="mr-1 h-4 w-4" />
              Find
            </Button>
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              aria-label="Open settings"
            >
              <Link href="/settings">
                <Settings2 className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex shrink-0 border-b p-4 sm:p-6">
          <div className="relative w-full max-w-xs">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              value={textSearch}
              onChange={(e) => {
                setTextSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Filter list by name…"
              className="pl-9"
            />
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div ref={rowsViewportRef} className="absolute inset-0 overflow-hidden">
            {pageRows.length === 0 ? (
              <div className="text-muted-foreground flex h-full items-center justify-center px-4 text-center text-sm sm:px-6">
                    No leads in this view. Use Find or Business for a new batch of
                    10, or sync Meeting for Fathom.
              </div>
            ) : (
              <table className="h-full w-full table-fixed border-collapse text-sm">
                <colgroup>
                  <col />
                  <col className="w-[7rem]" />
                  <col className="w-[8.5rem]" />
                  <col className="w-[4.5rem]" />
                </colgroup>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-14 pl-4 sm:pl-6">Lead</TableHead>
                    <TableHead className="h-14">Kind</TableHead>
                    <TableHead className="h-14">Outbound</TableHead>
                    <TableHead className="h-14 pr-4 text-center sm:pr-6">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: rowsPerPage }, (_, index) => {
                    const lead = pageRows[index]
                    if (!lead) {
                      return (
                        <TableRow
                          key={`empty-${index}`}
                          style={{ height: rowHeightPx }}
                          className="border-0 hover:bg-transparent"
                        >
                          <TableCell colSpan={4} className="p-0" />
                        </TableRow>
                      )
                    }
                    return (
                      <TableRow
                        key={lead.id}
                        style={{ height: rowHeightPx }}
                        className="hover:bg-muted/40"
                      >
                        <TableCell className="overflow-hidden pl-4 sm:pl-6">
                          <Link
                            href={`/lead/${lead.id}`}
                            className="flex min-w-0 items-center gap-3"
                          >
                            <Avatar className="size-9 shrink-0">
                              <AvatarFallback>
                                {initials(lead.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                {lead.name}
                              </div>
                              <div className="text-muted-foreground truncate text-xs">
                                {lead.kind === 'Business'
                                  ? lead.address ||
                                    lead.company ||
                                    'Business prospect'
                                  : lead.emailIsSynthetic
                                    ? 'Name-only lead (no guest email)'
                                    : lead.email}
                              </div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="overflow-hidden">
                          <div className="flex min-w-0 items-center gap-2 text-sm">
                            {lead.kind === 'Instant' ? (
                              <FileAudio className="text-muted-foreground size-4 shrink-0" />
                            ) : lead.kind === 'Business' ? (
                              <Building2 className="text-muted-foreground size-4 shrink-0" />
                            ) : (
                              <CalendarDays className="text-muted-foreground size-4 shrink-0" />
                            )}
                            <span className="truncate">{lead.kind}</span>
                          </div>
                        </TableCell>
                        <TableCell className="overflow-hidden">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => cycleOutbound(lead)}
                            className="cursor-pointer"
                            title="Click to cycle: new → on process → done"
                          >
                            <Badge
                              variant="secondary"
                              className={cn(
                                'border-0 font-normal capitalize',
                                OUTBOUND_STYLES[lead.outboundStatus],
                              )}
                            >
                              {OUTBOUND_LABEL[lead.outboundStatus]}
                            </Badge>
                          </button>
                        </TableCell>
                        <TableCell className="overflow-hidden pr-4 text-center sm:pr-6">
                          <Button asChild variant="ghost" size="icon">
                            <Link
                              href={`/lead/${lead.id}`}
                              aria-label="View lead"
                            >
                              <Eye className="size-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </table>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <p className="text-muted-foreground text-sm">
            Showing {showingFrom} to {showingTo} of {filtered.length} entries
            <span className="text-muted-foreground/80"> · 5 per page</span>
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
