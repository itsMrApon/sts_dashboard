'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, useTransition, type ReactNode } from 'react'
import { format } from 'date-fns'
import { Download, Search } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  LeadsFilterPill,
  LeadsTable,
  leadPillClass,
  type LeadStatusKey,
  type LeadsTableRow,
} from '@/components/ui/leads-data-table'
import { setLeadOutboundStatus } from '@/actions/callIntel'
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

/** A /lead/intel import, offered in the batch filter. */
export type LeadImportBatchOption = {
  id: string
  app: string
  label: string
  createdAt: string
  rowCount: number
}

const IMPORT_APP_NAME: Record<string, string> = {
  SELLBIRD: 'Sellbird',
  N8N: 'n8n',
  CSV: 'CSV',
  GOOGLE_DRIVE: 'Google Drive',
}

export type LeadListRow = {
  id: string
  name: string
  email: string
  emailIsSynthetic: boolean
  company: string | null
  /** Their job title at the company. */
  position?: string | null
  notes: string | null
  phone?: string | null
  createdAt?: string
  website?: string | null
  address?: string | null
  selectedAgentId: string | null
  lastAppointmentAt: string | null
  updatedAt: string
  nextFollowUpAt?: string | null
  kind: 'Instant' | 'Calendar' | 'Business' | 'Imported'
  outboundStatus: OutboundStatus
  searchBatchId?: string | null
  /** Set when the lead came in (or was matched) through /lead/intel. */
  importApp?: string | null
  importBatchId?: string | null
  searchBatch?: {
    id: string
    createdAt: string
    location: string
    niche: string
  } | null
  hasResearch: boolean
  /** 0–100: the call score, or the playbook fit from the website scan. */
  fitScore?: number | null
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
  searchBatches?: LeadSearchBatchOption[]
  importBatches?: LeadImportBatchOption[]
  hasGeminiKey: boolean
}

type KindFilter = 'ALL' | LeadListRow['kind']

const KIND_OPTIONS: Array<{ value: KindFilter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'Business', label: 'Google Maps' },
  { value: 'Instant', label: 'Fathom' },
  { value: 'Calendar', label: 'Calendar' },
  { value: 'Imported', label: 'Imported' },
]

const STATUS_OPTIONS: Array<{ value: 'ALL' | OutboundStatus; label: string }> = [
  { value: 'ALL', label: 'Any' },
  { value: 'NEW', label: 'New' },
  { value: 'ON_PROCESS', label: 'In progress' },
  { value: 'DONE', label: 'Done' },
]

const STATUS_KEY: Record<OutboundStatus, LeadStatusKey> = { NEW: 'new', ON_PROCESS: 'in-progress', DONE: 'done' }
const STATUS_ORDER: OutboundStatus[] = ['NEW', 'ON_PROCESS', 'DONE']
const STATUS_WORD: Record<OutboundStatus, string> = { NEW: 'new', ON_PROCESS: 'in progress', DONE: 'done' }

const ROWS_PER_PAGE = 10

function batchLabel(batch: LeadSearchBatchOption): string {
  const d = new Date(batch.createdAt)
  const today = new Date()
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startBatch = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((startToday.getTime() - startBatch.getTime()) / 86_400_000)
  if (diffDays <= 0) return `Today · ${batch.niche} in ${batch.location}`
  if (diffDays === 1) return `Yesterday · ${batch.niche}`
  return `${diffDays}d ago · ${batch.niche}`
}

/** When something last happened with this lead: a meeting, or any change to it. */
function lastActionAt(lead: LeadListRow): number {
  const updated = new Date(lead.updatedAt).getTime()
  const met = lead.lastAppointmentAt ? new Date(lead.lastAppointmentAt).getTime() : 0
  return Math.max(updated, met)
}

/** The last thing that happened, in a few words: "Met Nov 12", "Added Nov 21", "Updated Nov 22". */
function lastAction(lead: LeadListRow): string {
  const at = lastActionAt(lead)
  const day = format(new Date(at), 'MMM d')
  if (lead.lastAppointmentAt && new Date(lead.lastAppointmentAt).getTime() === at) return `Met ${day}`
  const created = lead.createdAt ? new Date(lead.createdAt).getTime() : at
  return at - created < 60_000 ? `Added ${day}` : `Updated ${day}`
}

const host = (url: string | null | undefined) =>
  url ? url.replace(/^[a-z]+:\/\//i, '').replace(/^www\./, '').split(/[/?#]/)[0] || null : null

/** Who this is, under the name: their email, or for a business its phone or site. */
function leadSubtitle(lead: LeadListRow): string {
  if (!lead.emailIsSynthetic) return lead.email
  if (lead.kind === 'Instant') return 'Name only (no guest email)'
  return lead.phone || host(lead.website) || lead.company || 'No contact yet'
}

function sourceOf(lead: LeadListRow): LeadsTableRow['source'] {
  if (lead.kind === 'Imported') return { label: IMPORT_APP_NAME[lead.importApp || ''] ?? 'Import', tone: 'imported' }
  if (lead.kind === 'Business') return { label: 'Google Maps', tone: 'found' }
  if (lead.kind === 'Instant') return { label: 'Fathom', tone: 'found' }
  return { label: 'Calendar', tone: 'found' }
}

function csvCell(value: string | null | undefined): string {
  const text = value ?? ''
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** The selected leads as a CSV the browser saves. Stand-in emails are left out. */
function downloadCsv(leads: LeadListRow[]) {
  const header = ['Name', 'Email', 'Phone', 'Website', 'Company', 'Address', 'Source', 'Status']
  const lines = leads.map((l) =>
    [l.name, l.emailIsSynthetic ? '' : l.email, l.phone, l.website, l.company, l.address, sourceOf(l).label, STATUS_WORD[l.outboundStatus]]
      .map(csvCell)
      .join(','),
  )
  // A byte-order mark so Excel reads Bangla and other scripts as UTF-8.
  const blob = new Blob(['﻿' + [header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `leads-${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/** A toolbar filter: one of the table's pills that opens a menu of choices. */
function FilterMenu<T extends string>({
  label,
  value,
  valueLabel,
  active,
  onChange,
  children,
}: {
  label: string
  value: T
  valueLabel: string
  active: boolean
  onChange: (value: T) => void
  children: ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${label}: ${valueLabel}`}
        className="focus-visible:ring-ring/50 rounded-lg focus-visible:ring-[3px] focus-visible:outline-none"
      >
        <LeadsFilterPill label={label} value={valueLabel} active={active} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 min-w-48 overflow-y-auto">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as T)}>
          {children}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const pageButton = cn(
  leadPillClass,
  'bg-muted/20 text-foreground/80 border-border/50 hover:bg-muted/40 transition-colors disabled:pointer-events-none disabled:opacity-40',
)

export function LeadList(props: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [textSearch, setTextSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<KindFilter>('ALL')
  // Every lead by default; /lead/intel links here with ?batch=import:<id> to show one import.
  const [batchFilter, setBatchFilter] = useState<string>(() => searchParams.get('batch') || 'ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | OutboundStatus>('ALL')
  const [page, setPage] = useState(1)

  const batches = props.searchBatches || []
  const importBatches = props.importBatches || []
  const todayBatchId = batches[0]?.id || null

  const filtered = useMemo(() => {
    const q = textSearch.trim().toLowerCase()
    const matches = props.leads.filter((lead) => {
      if (kindFilter !== 'ALL' && lead.kind !== kindFilter) return false
      if (statusFilter !== 'ALL' && lead.outboundStatus !== statusFilter) return false
      if (batchFilter === 'TODAY') {
        if (lead.kind === 'Business' && (!todayBatchId || lead.searchBatchId !== todayBatchId)) return false
      } else if (batchFilter.startsWith('import:')) {
        if (lead.importBatchId !== batchFilter.slice('import:'.length)) return false
      } else if (batchFilter !== 'ALL') {
        if (lead.searchBatchId !== batchFilter) return false
      }
      if (!q) return true
      return (
        lead.name.toLowerCase().includes(q) ||
        lead.email.toLowerCase().includes(q) ||
        (lead.company || '').toLowerCase().includes(q) ||
        (lead.address || '').toLowerCase().includes(q) ||
        (lead.position || '').toLowerCase().includes(q)
      )
    })
    // Latest action first.
    return matches.sort((a, b) => lastActionAt(b) - lastActionAt(a))
  }, [props.leads, textSearch, kindFilter, statusFilter, batchFilter, todayBatchId])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const from = filtered.length === 0 ? 0 : (currentPage - 1) * ROWS_PER_PAGE + 1
  const to = Math.min(currentPage * ROWS_PER_PAGE, filtered.length)
  const pageLeads = filtered.slice(from - 1, to)

  const rows: LeadsTableRow[] = pageLeads.map((lead) => ({
    id: lead.id,
    name: lead.name,
    subtitle: leadSubtitle(lead),
    href: `/lead/${lead.id}`,
    source: sourceOf(lead),
    status: STATUS_KEY[lead.outboundStatus],
    position: lead.position || null,
    score: lead.fitScore ?? null,
    lastAction: lastAction(lead),
  }))

  const byId = useMemo(() => new Map(props.leads.map((l) => [l.id, l])), [props.leads])

  function setStatus(ids: string[], next: OutboundStatus, after?: () => void) {
    startTransition(
      guardAction(async () => {
        const results = await Promise.all(ids.map((id) => setLeadOutboundStatus(id, next)))
        const failed = results.filter((r) => !r.ok).length
        if (failed) toast.error(`${failed} of ${ids.length} didn’t change. Try again.`)
        else toast.success(ids.length === 1 ? `Marked ${STATUS_WORD[next]}` : `${ids.length} leads marked ${STATUS_WORD[next]}`)
        after?.()
        router.refresh()
      }),
    )
  }

  const batchValueLabel =
    batchFilter === 'TODAY'
      ? 'Today'
      : batchFilter === 'ALL'
        ? 'All'
        : batchFilter.startsWith('import:')
          ? (importBatches.find((b) => `import:${b.id}` === batchFilter)?.label ?? 'Import')
          : (batches.find((b) => b.id === batchFilter)?.niche ?? 'Batch')

  const toolbar = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-foreground/90 shrink-0 text-sm font-medium whitespace-nowrap">
          Leads <span className="text-muted-foreground/70 font-normal tabular-nums">· {filtered.length}</span>
        </h2>
        <label className="border-border/50 bg-muted/20 focus-within:ring-ring/50 relative flex h-8 w-full max-w-60 items-center rounded-lg border focus-within:ring-[3px]">
          <Search className="text-muted-foreground/70 absolute left-2.5 size-3.5" aria-hidden="true" />
          <input
            value={textSearch}
            onChange={(e) => {
              setTextSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Name, email or address"
            aria-label="Filter leads"
            className="placeholder:text-muted-foreground/60 h-full w-full bg-transparent pr-2 pl-8 text-xs outline-none"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FilterMenu
          label="Type"
          value={kindFilter}
          valueLabel={KIND_OPTIONS.find((o) => o.value === kindFilter)?.label ?? 'All'}
          active={kindFilter !== 'ALL'}
          onChange={(v) => {
            setKindFilter(v)
            setPage(1)
          }}
        >
          {KIND_OPTIONS.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </FilterMenu>

        <FilterMenu
          label="Batch"
          value={batchFilter}
          valueLabel={batchValueLabel}
          active={batchFilter !== 'ALL'}
          onChange={(v) => {
            setBatchFilter(v)
            setPage(1)
          }}
        >
          <DropdownMenuRadioItem value="TODAY">Today</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="ALL">All batches</DropdownMenuRadioItem>
          {batches.length ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-muted-foreground text-xs">Google Maps</DropdownMenuLabel>
              {batches.map((b) => (
                <DropdownMenuRadioItem key={b.id} value={b.id}>
                  {batchLabel(b)}
                </DropdownMenuRadioItem>
              ))}
            </>
          ) : null}
          {importBatches.length ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-muted-foreground text-xs">Imports</DropdownMenuLabel>
              {importBatches.map((b) => (
                <DropdownMenuRadioItem key={b.id} value={`import:${b.id}`}>
                  {`${IMPORT_APP_NAME[b.app] ?? b.app} · ${b.label}`}
                </DropdownMenuRadioItem>
              ))}
            </>
          ) : null}
        </FilterMenu>

        <FilterMenu
          label="Status"
          value={statusFilter}
          valueLabel={STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label ?? 'Any'}
          active={statusFilter !== 'ALL'}
          onChange={(v) => {
            setStatusFilter(v)
            setPage(1)
          }}
        >
          {STATUS_OPTIONS.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </FilterMenu>

        {/* Every lead, as an .xlsx in the Name · Position · Company Name · Address · Contact Number · Remarks layout. */}
        <a
          href="/api/leads/export"
          download
          className={cn(
            leadPillClass,
            'gap-1.5 bg-muted/20 text-foreground/80 border-border/50 hover:bg-muted/40 uppercase tracking-wide transition-colors',
          )}
        >
          <Download className="size-3" aria-hidden="true" />
          Export
        </a>
      </div>
    </div>
  )

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <p className="text-muted-foreground/70 text-xs tabular-nums">
        {filtered.length === 0 ? 'No leads' : `${from}–${to} of ${filtered.length}`}
      </p>
      <div className="flex items-center gap-2">
        <button type="button" className={pageButton} disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          Previous
        </button>
        <span className="text-muted-foreground/80 text-xs tabular-nums">
          {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          className={pageButton}
          disabled={currentPage >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          Next
        </button>
      </div>
    </div>
  )

  return (
    // Scrolls as a whole on short screens so the toolbar never squeezes the rows away.
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pb-4">
      {!props.hasGeminiKey ? (
        <Card className="shrink-0 border-amber-500/40 bg-amber-500/5 p-4 shadow-none">
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-sm text-amber-800 dark:text-amber-300">
              Add a Gemini key in Config Agent to score summaries and run research.
            </p>
            <Button asChild size="sm">
              <Link href="/ai-agents/config">Get help from the Config Agent</Link>
            </Button>
          </div>
        </Card>
      ) : null}

      <LeadsTable
        rows={rows}
        toolbar={toolbar}
        footer={footer}
        onStatusClick={(id) => {
          const lead = byId.get(id)
          if (!lead || pending) return
          setStatus([id], STATUS_ORDER[(STATUS_ORDER.indexOf(lead.outboundStatus) + 1) % STATUS_ORDER.length]!)
        }}
        selectionActions={(ids, clear) => (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => setStatus(ids, 'ON_PROCESS', clear)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
            >
              Mark in progress
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setStatus(ids, 'DONE', clear)}
              className="bg-muted hover:bg-muted/80 text-foreground/80 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
            >
              Mark done
            </button>
            <button
              type="button"
              onClick={() => downloadCsv(ids.map((id) => byId.get(id)).filter((l): l is LeadListRow => Boolean(l)))}
              className="bg-muted hover:bg-muted/80 text-foreground/80 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            >
              Download as .CSV
            </button>
          </>
        )}
        empty={
          <div className="text-muted-foreground flex min-h-[200px] flex-col items-center justify-center gap-1 px-6 text-center text-sm">
            <p className="text-foreground font-medium">No leads in this view</p>
            <p>
              Try another batch, or bring leads in from{' '}
              <Link href="/lead" className="text-foreground underline">
                Intel
              </Link>
              .
            </p>
          </div>
        }
      />
    </div>
  )
}
