'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  StickyNote,
  Video,
  Building2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  addLeadActivity,
  scheduleLeadGoogleMeet,
  setLeadOutboundStatus,
} from '@/actions/callIntel'
import { cn } from '@/lib/utils'
import type { OutboundStatus } from '../LeadList'

export type LeadCalendarMonth = {
  month: string
  todayBatch: {
    id: string
    location: string
    niche: string
    createdAt: string
    leads: Array<{
      id: string
      name: string
      company: string | null
      outboundStatus: OutboundStatus
      website: string | null
      phone: string | null
    }>
  } | null
  activities: Array<{
    id: string
    type: string
    note: string | null
    scheduledAt: string | null
    createdAt: string
    meetLink: string | null
    leadId: string
    leadName: string
  }>
  followUps: Array<{
    id: string
    name: string
    source: string
    outboundStatus: OutboundStatus
    nextFollowUpAt: string
  }>
  fathomMeetings: Array<{
    id: string
    recordedAt: string
    summary: string | null
    leadId: string | null
    leadName: string | null
  }>
  googleEvents: Array<{
    id: string
    title: string
    start: string
    htmlLink: string | null
  }>
}

type Props = {
  calendarMonth: LeadCalendarMonth
  gcalOk?: boolean
}

type EventKind = 'meet' | 'fathom' | 'follow_up' | 'note' | 'activity'

type CalendarChip = {
  id: string
  title: string
  start: Date
  end: Date
  kind: EventKind
  leadId?: string | null
  meetLink?: string | null
  htmlLink?: string | null
  note?: string | null
  outboundStatus?: OutboundStatus
  summary?: string | null
}

const OUTBOUND_LABEL: Record<OutboundStatus, string> = {
  NEW: 'new',
  ON_PROCESS: 'on process',
  DONE: 'done',
}

const KIND_BAR: Record<EventKind, string> = {
  meet: 'bg-violet-500',
  fathom: 'bg-amber-500',
  follow_up: 'bg-emerald-500',
  note: 'bg-zinc-400',
  activity: 'bg-sky-500',
}

const KIND_CHIP: Record<EventKind, string> = {
  meet: 'bg-violet-500/10 border-violet-500/30 text-violet-900 dark:text-violet-100',
  fathom: 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-100',
  follow_up:
    'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-100',
  note: 'bg-muted border-border text-foreground',
  activity: 'bg-sky-500/10 border-sky-500/30 text-sky-900 dark:text-sky-100',
}

const START_HOUR = 8
const END_HOUR = 20
const PX_PER_MINUTE = 1.1
const HOURS = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, i) => START_HOUR + i,
)

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay() // 0 Sun
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  return x
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function sameDay(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b)
}

function minutesFromStart(d: Date): number {
  return d.getHours() * 60 + d.getMinutes() - START_HOUR * 60
}

function clampEventTop(start: Date): number {
  const mins = minutesFromStart(start)
  if (mins < 0) return 0
  const max = (END_HOUR - START_HOUR) * 60
  return Math.min(mins, max - 15) * PX_PER_MINUTE
}

function eventHeight(start: Date, end: Date): number {
  const duration = Math.max(30, (end.getTime() - start.getTime()) / 60_000)
  return Math.max(28, duration * PX_PER_MINUTE)
}

export function LeadCalendar({ calendarMonth, gcalOk }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()))
  const [selectedDay, setSelectedDay] = useState(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  })
  const [selected, setSelected] = useState<CalendarChip | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [meetOpen, setMeetOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [slotLeadId, setSlotLeadId] = useState<string | null>(null)
  const [slotLeadName, setSlotLeadName] = useState('')
  const [meetStart, setMeetStart] = useState('')
  const [noteText, setNoteText] = useState('')
  const [followUpAt, setFollowUpAt] = useState('')

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const chips = useMemo(() => {
    const list: CalendarChip[] = []

    for (const ev of calendarMonth.googleEvents) {
      const start = new Date(ev.start)
      const end = new Date(start.getTime() + 30 * 60_000)
      list.push({
        id: `gcal-${ev.id}`,
        title: ev.title,
        start,
        end,
        kind: 'meet',
        htmlLink: ev.htmlLink,
      })
    }

    for (const m of calendarMonth.fathomMeetings) {
      const start = new Date(m.recordedAt)
      const end = new Date(start.getTime() + 45 * 60_000)
      list.push({
        id: `fathom-${m.id}`,
        title: m.leadName || 'Fathom meeting',
        start,
        end,
        kind: 'fathom',
        leadId: m.leadId,
        summary: m.summary,
      })
    }

    for (const f of calendarMonth.followUps) {
      const start = new Date(f.nextFollowUpAt)
      const end = new Date(start.getTime() + 30 * 60_000)
      list.push({
        id: `fu-${f.id}`,
        title: f.name,
        start,
        end,
        kind: 'follow_up',
        leadId: f.id,
        outboundStatus: f.outboundStatus,
      })
    }

    for (const a of calendarMonth.activities) {
      if (a.type === 'MEET_SCHEDULED' && a.scheduledAt) {
        const start = new Date(a.scheduledAt)
        const end = new Date(start.getTime() + 30 * 60_000)
        list.push({
          id: `act-meet-${a.id}`,
          title: a.leadName,
          start,
          end,
          kind: 'meet',
          leadId: a.leadId,
          meetLink: a.meetLink,
          note: a.note,
        })
        continue
      }
      const start = new Date(a.scheduledAt || a.createdAt)
      const end = new Date(start.getTime() + 30 * 60_000)
      list.push({
        id: `act-${a.id}`,
        title: a.leadName,
        start,
        end,
        kind: a.type === 'FOLLOW_UP' ? 'follow_up' : 'note',
        leadId: a.leadId,
        note: a.note,
        meetLink: a.meetLink,
      })
    }

    return list.sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [calendarMonth])

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6)
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    return `${weekStart.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, { ...opts, year: 'numeric' })}`
  }, [weekStart])

  const dayStripLeads = useMemo(() => {
    if (!calendarMonth.todayBatch) return []
    if (!sameDay(selectedDay, new Date())) return []
    return calendarMonth.todayBatch.leads
  }, [calendarMonth.todayBatch, selectedDay])

  const gridHeight = (END_HOUR - START_HOUR) * 60 * PX_PER_MINUTE

  function openChip(chip: CalendarChip) {
    setSelected(chip)
    setSheetOpen(true)
  }

  function openMeetForLead(leadId: string, name: string, preset?: Date) {
    setSlotLeadId(leadId)
    setSlotLeadName(name)
    const next = preset ? new Date(preset) : new Date()
    if (!preset) {
      next.setMinutes(0, 0, 0)
      next.setHours(next.getHours() + 1)
    }
    setMeetStart(toLocalInput(next))
    setMeetOpen(true)
  }

  function openNoteForLead(leadId: string, name: string) {
    setSlotLeadId(leadId)
    setSlotLeadName(name)
    setNoteText('')
    setFollowUpAt('')
    setNoteOpen(true)
  }

  function onEmptySlotClick(day: Date, hour: number) {
    const start = new Date(day)
    start.setHours(hour, 0, 0, 0)
    // Prefer first NEW lead from today's batch if selecting today
    const batchLead =
      sameDay(day, new Date()) && calendarMonth.todayBatch
        ? calendarMonth.todayBatch.leads.find((l) => l.outboundStatus === 'NEW') ||
          calendarMonth.todayBatch.leads[0]
        : null
    if (batchLead) {
      openMeetForLead(batchLead.id, batchLead.name, start)
      return
    }
    toast.message(
      'Drag a lead from Today’s outreach onto this slot, or open a lead profile',
    )
    setSelectedDay(day)
  }

  function onLeadDropOnSlot(
    day: Date,
    hour: number,
    payload: { id: string; name: string },
  ) {
    const start = new Date(day)
    start.setHours(hour, 0, 0, 0)
    openMeetForLead(payload.id, payload.name, start)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      {/* Chrome — Cal-style: Today / week / range */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const t = new Date()
              setWeekStart(startOfWeekMonday(t))
              const day = new Date(t)
              day.setHours(0, 0, 0, 0)
              setSelectedDay(day)
            }}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            <ChevronRight className="size-4" />
          </Button>
          <span className="px-1 text-sm font-medium tabular-nums">{weekLabel}</span>
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
          <LegendDot className="bg-sky-500" label="Outreach batch" />
          <LegendDot className="bg-violet-500" label="Meet" />
          <LegendDot className="bg-amber-500" label="Fathom" />
          <LegendDot className="bg-emerald-500" label="Follow-up" />
        </div>
      </div>

      {/* Day strip — today's 10 Maps leads (Cal list density) */}
      {dayStripLeads.length > 0 ? (
        <div className="shrink-0 rounded-xl border">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="size-4 text-sky-600" />
              Today&apos;s outreach
              <span className="text-muted-foreground font-normal">
                · {calendarMonth.todayBatch?.niche} in{' '}
                {calendarMonth.todayBatch?.location}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground hidden text-xs sm:inline">
                Drag onto a time slot
              </span>
              <Badge variant="secondary">{dayStripLeads.length} leads</Badge>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto p-3">
            {dayStripLeads.map((lead) => (
              <button
                key={lead.id}
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    'application/sts-lead',
                    JSON.stringify({ id: lead.id, name: lead.name }),
                  )
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onClick={() =>
                  openChip({
                    id: `batch-${lead.id}`,
                    title: lead.name,
                    start: selectedDay,
                    end: selectedDay,
                    kind: 'activity',
                    leadId: lead.id,
                    outboundStatus: lead.outboundStatus,
                    note: lead.phone || lead.website || lead.company,
                  })
                }
                className={cn(
                  'min-w-[160px] shrink-0 cursor-grab rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 active:cursor-grabbing',
                  KIND_CHIP.activity,
                )}
              >
                <div className="truncate font-medium">{lead.name}</div>
                <div className="text-muted-foreground mt-0.5 truncate text-xs capitalize">
                  {OUTBOUND_LABEL[lead.outboundStatus]}
                  {lead.phone ? ` · ${lead.phone}` : ''}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Full-width week grid */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border">
        {/* Day headers */}
        <div className="bg-background sticky top-0 z-10 grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b">
          <div className="border-r" />
          {weekDays.map((day) => {
            const isToday = sameDay(day, new Date())
            const isSelected = sameDay(day, selectedDay)
            return (
              <button
                key={dateKey(day)}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={cn(
                  'border-r px-1 py-2 text-center last:border-r-0',
                  isSelected && 'bg-primary/5',
                )}
              >
                <div className="text-muted-foreground text-[11px] font-medium uppercase">
                  {day.toLocaleDateString(undefined, { weekday: 'short' })}
                </div>
                <div
                  className={cn(
                    'mx-auto mt-0.5 flex size-8 items-center justify-center rounded-full text-sm font-semibold',
                    isToday && 'bg-primary text-primary-foreground',
                  )}
                >
                  {day.getDate()}
                </div>
              </button>
            )
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div
            className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]"
            style={{ height: gridHeight }}
          >
            {/* Time gutter */}
            <div className="relative border-r">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="text-muted-foreground absolute right-2 -translate-y-1/2 text-[10px] tabular-nums"
                  style={{
                    top: (h - START_HOUR) * 60 * PX_PER_MINUTE,
                  }}
                >
                  {`${String(h).padStart(2, '0')}:00`}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((day) => {
              const dayChips = chips.filter((c) => sameDay(c.start, day))
              return (
                <div
                  key={dateKey(day)}
                  className={cn(
                    'relative border-r last:border-r-0',
                    sameDay(day, selectedDay) && 'bg-primary/[0.02]',
                  )}
                >
                  {HOURS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      aria-label={`Schedule at ${h}:00`}
                      className="hover:bg-muted/40 absolute inset-x-0 border-b border-border/50 transition-colors"
                      style={{
                        top: (h - START_HOUR) * 60 * PX_PER_MINUTE,
                        height: 60 * PX_PER_MINUTE,
                      }}
                      onClick={() => onEmptySlotClick(day, h)}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'copy'
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        const raw = e.dataTransfer.getData('application/sts-lead')
                        if (!raw) return
                        try {
                          const payload = JSON.parse(raw) as {
                            id?: string
                            name?: string
                          }
                          if (payload.id && payload.name) {
                            onLeadDropOnSlot(day, h, {
                              id: payload.id,
                              name: payload.name,
                            })
                          }
                        } catch {
                          /* ignore bad payload */
                        }
                      }}
                    />
                  ))}

                  {dayChips.map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        openChip(chip)
                      }}
                      className={cn(
                        'absolute inset-x-1 z-[1] overflow-hidden rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm transition-colors hover:brightness-95',
                        KIND_CHIP[chip.kind],
                      )}
                      style={{
                        top: clampEventTop(chip.start),
                        height: eventHeight(chip.start, chip.end),
                      }}
                      title={chip.title}
                    >
                      <div className="flex h-full gap-1">
                        <span
                          className={cn(
                            'mt-0.5 w-0.5 shrink-0 rounded-full',
                            KIND_BAR[chip.kind],
                          )}
                        />
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{chip.title}</div>
                          <div className="text-muted-foreground truncate">
                            {chip.start.toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Detail Sheet — Cal BookingDetailsSheet pattern */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md">
          {selected ? (
            <>
              <SheetHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {selected.kind.replace('_', ' ')}
                  </Badge>
                  {selected.outboundStatus ? (
                    <Badge variant="outline" className="capitalize">
                      {OUTBOUND_LABEL[selected.outboundStatus]}
                    </Badge>
                  ) : null}
                </div>
                <SheetTitle className="text-left">{selected.title}</SheetTitle>
                <SheetDescription className="text-left">
                  {selected.start.toLocaleString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 flex flex-col gap-4 px-1">
                {selected.summary ? (
                  <p className="text-muted-foreground text-sm">{selected.summary}</p>
                ) : null}
                {selected.note ? (
                  <div className="rounded-lg border p-3 text-sm">
                    <div className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                      Notes
                    </div>
                    {selected.note}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {selected.meetLink || selected.htmlLink ? (
                    <Button asChild size="sm">
                      <a
                        href={selected.meetLink || selected.htmlLink || '#'}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Video className="mr-1.5 size-3.5" />
                        Join
                        <ExternalLink className="ml-1 size-3 opacity-70" />
                      </a>
                    </Button>
                  ) : null}

                  {selected.leadId ? (
                    <>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/lead/${selected.leadId}`}>Open lead</Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          openNoteForLead(selected.leadId!, selected.title)
                        }
                      >
                        <StickyNote className="mr-1.5 size-3.5" />
                        Note
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending || !gcalOk}
                        onClick={() =>
                          openMeetForLead(selected.leadId!, selected.title)
                        }
                      >
                        <Video className="mr-1.5 size-3.5" />
                        Schedule Meet
                      </Button>
                      {selected.outboundStatus ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          onClick={() => {
                            const order: OutboundStatus[] = [
                              'NEW',
                              'ON_PROCESS',
                              'DONE',
                            ]
                            const next =
                              order[
                                (order.indexOf(selected.outboundStatus!) + 1) %
                                  order.length
                              ]!
                            startTransition(async () => {
                              const res = await setLeadOutboundStatus(
                                selected.leadId!,
                                next,
                              )
                              if (res.ok) {
                                toast.success(`Marked ${OUTBOUND_LABEL[next]}`)
                                setSelected({
                                  ...selected,
                                  outboundStatus: next,
                                })
                                router.refresh()
                              } else toast.error(res.error || 'Failed')
                            })
                          }}
                        >
                          Cycle status
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={meetOpen} onOpenChange={setMeetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Google Meet</DialogTitle>
            <DialogDescription>
              Create a Meet for {slotLeadName} on your Google Calendar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="meet-start">Start</Label>
            <Input
              id="meet-start"
              type="datetime-local"
              value={meetStart}
              onChange={(e) => setMeetStart(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMeetOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending || !slotLeadId || !meetStart}
              onClick={() => {
                if (!slotLeadId) return
                startTransition(async () => {
                  const res = await scheduleLeadGoogleMeet({
                    leadId: slotLeadId,
                    startIso: new Date(meetStart).toISOString(),
                  })
                  if (res.ok) {
                    toast.success(
                      res.data?.meetLink
                        ? 'Meet scheduled'
                        : 'Calendar event created',
                    )
                    setMeetOpen(false)
                    setSheetOpen(false)
                    router.refresh()
                  } else {
                    const needsSettings =
                      /Settings|OAuth|reconnect|Connect Google/i.test(
                        res.error || '',
                      )
                    toast.error(res.error || 'Failed', {
                      action: needsSettings
                        ? {
                            label: 'Settings',
                            onClick: () => router.push('/settings'),
                          }
                        : undefined,
                    })
                  }
                })
              }}
            >
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Note / follow-up</DialogTitle>
            <DialogDescription>
              Save approach history for {slotLeadName}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="note-text">Note</Label>
              <Input
                id="note-text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Said call next week…"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="follow-up">Follow-up (optional)</Label>
              <Input
                id="follow-up"
                type="datetime-local"
                value={followUpAt}
                onChange={(e) => setFollowUpAt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending || !slotLeadId || !noteText.trim()}
              onClick={() => {
                if (!slotLeadId) return
                startTransition(async () => {
                  const res = await addLeadActivity({
                    leadId: slotLeadId,
                    type: followUpAt ? 'FOLLOW_UP' : 'NOTE',
                    note: noteText,
                    scheduledAt: followUpAt
                      ? new Date(followUpAt).toISOString()
                      : null,
                  })
                  if (res.ok) {
                    toast.success('Saved')
                    setNoteOpen(false)
                    router.refresh()
                  } else toast.error(res.error || 'Failed')
                })
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('size-1.5 rounded-full', className)} />
      {label}
    </span>
  )
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
