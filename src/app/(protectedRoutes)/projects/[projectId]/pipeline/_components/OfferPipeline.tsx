'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNowStrict, format } from 'date-fns'
import { ArrowLeft, Bot, Loader2, Mail, MessageSquare, Mic, Phone, Search, SendHorizontal, Users } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import { cn } from '@/lib/utils'
import { getPipelineThread, sendPipelineReply } from '@/actions/pipeline'
import {
  CHATTING_NOW_MS,
  type PipelineOrderStatus,
  type PipelinePerson,
  type PipelineThread,
  type PipelineView,
} from '@/lib/offers/offerPipelineTypes'

type Filter = 'all' | 'ai' | 'paid'

const THREAD_POLL_MS = 3000
const LIST_REFRESH_MS = 15_000

const ORDER_BADGE: Record<PipelineOrderStatus, { label: string; className: string }> = {
  PAID: { label: 'Paid', className: 'bg-green-500/15 text-green-500' },
  DEPOSIT_PAID: { label: 'Deposit paid', className: 'bg-green-500/15 text-green-500' },
  PENDING: { label: 'Didn’t finish', className: 'bg-amber-500/15 text-amber-500' },
  REFUNDED: { label: 'Refunded', className: 'bg-muted text-muted-foreground' },
  FAILED: { label: 'Payment failed', className: 'bg-red-500/15 text-red-400' },
  CANCELED: { label: 'Canceled', className: 'bg-muted text-muted-foreground' },
}

const usd = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents % 100 ? 2 : 0 }).format(
    cents / 100,
  )

const isPaid = (person: PipelinePerson) => person.order?.status === 'PAID' || person.order?.status === 'DEPOSIT_PAID'
const talkedToAi = (person: PipelinePerson) => !!person.chat?.count || person.voiceCalls > 0

function chattingNow(person: PipelinePerson, now: number) {
  return !!person.chat && now - new Date(person.chat.updatedAt).getTime() < CHATTING_NOW_MS
}

function ago(iso: string) {
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true })
}

function Stat({ label, value, live }: { label: string; value: number; live?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {live ? <span className={cn('h-1.5 w-1.5 rounded-full', value ? 'animate-pulse bg-green-500' : 'bg-muted-foreground/40')} /> : null}
        {label}
      </p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function PersonRow({
  person,
  selected,
  now,
  onSelect,
}: {
  person: PipelinePerson
  selected: boolean
  now: number
  onSelect: () => void
}) {
  const live = chattingNow(person, now)
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected}
        className={cn(
          'flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/40',
          selected && 'bg-muted/60',
        )}
      >
        <span className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
          {person.name.slice(0, 1).toUpperCase()}
          {live ? <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card bg-green-500" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">{person.name}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground" suppressHydrationWarning>
              {ago(person.lastActivityAt)}
            </span>
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {person.chat?.lastMessage ? (
              <>
                {person.chat.fromBuyerLast ? '' : 'AI: '}
                {person.chat.lastMessage}
              </>
            ) : (
              (person.email ?? person.phone)
            )}
          </span>
          <span className="mt-1.5 flex flex-wrap gap-1">
            {live ? <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] text-green-500">Chatting now</span> : null}
            {person.chat?.count ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                <MessageSquare className="h-3 w-3" /> {person.chat.count}
              </span>
            ) : null}
            {person.voiceCalls ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                <Mic className="h-3 w-3" /> {person.voiceCalls}
              </span>
            ) : null}
            {person.order ? (
              <span className={cn('rounded-full px-2 py-0.5 text-[11px]', ORDER_BADGE[person.order.status].className)}>
                {ORDER_BADGE[person.order.status].label}
                {isPaid(person) ? ` · ${usd(person.order.amountPaidCents)}` : ''}
              </span>
            ) : null}
            {!person.chat && !person.voiceCalls && !person.order && person.registeredAt ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                Registered{person.source === 'live' ? ' · Live' : ''}
              </span>
            ) : null}
          </span>
        </span>
      </button>
    </li>
  )
}

function Conversation({
  view,
  person,
  onBack,
}: {
  view: PipelineView
  person: PipelinePerson
  onBack: () => void
}) {
  const [thread, setThread] = useState<PipelineThread | null>(null)
  const [tab, setTab] = useState<'chat' | 'voice'>('chat')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const sendingRef = useRef(false)
  sendingRef.current = sending
  const listRef = useRef<HTMLDivElement>(null)
  const contactId = person.contactId

  const load = useCallback(async () => {
    if (!contactId) return
    const result = await getPipelineThread({ webinarId: view.offer.id, contactId }).catch(() => null)
    if (result?.ok) setThread(result.thread)
  }, [contactId, view.offer.id])

  useEffect(() => {
    setThread(null)
    setTab(person.chat || !person.voiceCalls ? 'chat' : 'voice')
    // Server actions run one at a time per page, so poll only after the last one finished
    // (and never while a reply is sending), or a reply would wait behind a queue of polls.
    let stopped = false
    let timer = 0
    const tick = async () => {
      if (document.visibilityState === 'visible' && !sendingRef.current) await load()
      if (!stopped) timer = window.setTimeout(tick, THREAD_POLL_MS)
    }
    void tick()
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
    // Reset only when switching people; counts changing must not reset the tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person.key, load])

  const messageCount = thread?.messages.length ?? 0
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messageCount, tab])

  const send = async () => {
    if (!contactId || !draft.trim() || sending) return
    setSending(true)
    try {
      const result = await sendPipelineReply({ webinarId: view.offer.id, contactId, text: draft })
      if (!result.ok) return void toast.error(result.error)
      setDraft('')
      setThread((current) => (current ? { ...current, messages: [...current.messages, result.message] } : current))
    } catch {
      toast.error("Couldn't send. Try again.")
    } finally {
      setSending(false)
    }
  }

  const waLink = person.phone ? `https://wa.me/${person.phone.replace(/\D/g, '')}` : null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button type="button" onClick={onBack} className="rounded-md p-1 hover:bg-muted md:hidden" aria-label="Back to people">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{person.name}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {person.email ? (
              <a href={`mailto:${person.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Mail className="h-3 w-3" /> {person.email}
              </a>
            ) : null}
            {waLink ? (
              <a href={waLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                <Phone className="h-3 w-3" /> {person.phone}
              </a>
            ) : null}
            {person.registeredAt ? <span>Registered {format(new Date(person.registeredAt), 'MMM d, h:mm a')}</span> : null}
          </div>
        </div>
        {person.order ? (
          <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs', ORDER_BADGE[person.order.status].className)}>
            {ORDER_BADGE[person.order.status].label}
            {isPaid(person) ? ` · ${usd(person.order.amountPaidCents)}` : ` · ${usd(person.order.amountTotalCents)}`}
          </span>
        ) : null}
      </div>

      {!contactId ? (
        <p className="p-6 text-sm text-muted-foreground">
          Signed up on an older waitlist form, so there is no conversation to show. Reach them at {person.email ?? person.phone}.
        </p>
      ) : (
        <>
          <div className="flex gap-1 border-b border-border px-3 py-2">
            {(
              [
                ['chat', 'Chat', <MessageSquare key="c" className="h-3.5 w-3.5" />, thread?.messages.length ?? person.chat?.count ?? 0],
                ['voice', 'Voice calls', <Mic key="v" className="h-3.5 w-3.5" />, thread?.calls.length ?? person.voiceCalls],
              ] as const
            ).map(([key, label, icon, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                  tab === key ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {icon}
                {label}
                <span className="text-xs text-muted-foreground">{count}</span>
              </button>
            ))}
          </div>

          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            {!thread ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : tab === 'chat' ? (
              thread.messages.length ? (
                <div className="space-y-2 text-sm">
                  {thread.messages.map((message, index) => (
                    <div key={index} className={cn('flex flex-col', message.role === 'user' ? 'items-start' : 'items-end')}>
                      <span className="mb-0.5 px-1 text-[11px] text-muted-foreground">
                        {message.role === 'user' ? person.name : message.from === 'creator' ? 'You' : 'AI'}
                        {message.timestamp ? ` · ${format(new Date(message.timestamp), 'h:mm a')}` : ''}
                      </span>
                      <p
                        className={cn(
                          'w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2',
                          message.role === 'user'
                            ? 'rounded-tl-sm bg-muted'
                            : message.from === 'creator'
                              ? 'rounded-tr-sm bg-primary text-primary-foreground'
                              : 'rounded-tr-sm border border-border bg-background',
                        )}
                      >
                        {message.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No chat yet. {view.offer.canChat ? 'Anything you send below appears in their chat on the share link.' : ''}
                </p>
              )
            ) : thread.calls.length ? (
              <div className="space-y-4">
                {thread.calls.map((call) => (
                  <details key={call.id} className="rounded-xl border border-border bg-background/50 p-3" open={thread.calls.length === 1}>
                    <summary className="cursor-pointer text-sm">
                      <span className="font-medium">{format(new Date(call.createdAt), 'MMM d, h:mm a')}</span>
                      <span className="text-muted-foreground">
                        {' '}
                        · {Math.max(1, Math.round(call.durationSec / 60))} min{call.outcome ? ` · ${call.outcome}` : ''}
                      </span>
                      {call.summary ? <p className="mt-1 text-xs text-muted-foreground">{call.summary}</p> : null}
                    </summary>
                    <div className="mt-3 space-y-1.5 text-sm">
                      {call.lines.map((line, index) => (
                        <p key={index}>
                          <span className="text-xs font-medium text-muted-foreground">{line.role === 'user' ? person.name : 'AI'}: </span>
                          {line.text}
                        </p>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No voice calls yet. Transcripts show up here when a call ends.</p>
            )}
          </div>

          {tab === 'chat' ? (
            view.offer.canChat ? (
              <form
                className="flex items-end gap-2 border-t border-border p-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  void send()
                }}
              >
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      void send()
                    }
                  }}
                  rows={1}
                  maxLength={2000}
                  placeholder={`Reply as ${view.offer.businessName}. They see it in their chat.`}
                  className="max-h-32 min-h-10 resize-none"
                  aria-label="Reply"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="flex h-10 shrink-0 items-center rounded-lg bg-primary px-3 text-primary-foreground disabled:opacity-50"
                  aria-label="Send reply"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                </button>
              </form>
            ) : (
              <p className="border-t border-border p-3 text-xs text-muted-foreground">
                Turn on the AI sales assistant for this offer to chat with buyers.{' '}
                <Link href={`/projects/${view.offer.id}`} className="underline underline-offset-2">
                  Offer settings
                </Link>
              </p>
            )
          ) : null}
        </>
      )}
    </div>
  )
}

/**
 * The offer's pipeline: everyone who registered, what they said to the AI (chat and voice),
 * and whether they paid. Open a chat to watch it live and reply into it.
 */
export function OfferPipeline({ view }: { view: PipelineView }) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // Fresh list (new sign-ups, chats, payments) without a reload.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      setNow(Date.now())
      router.refresh()
    }, LIST_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [router])

  const counts = useMemo(
    () => ({
      registered: view.people.filter((person) => person.registeredAt).length,
      ai: view.people.filter(talkedToAi).length,
      paid: view.people.filter(isPaid).length,
      live: view.people.filter((person) => chattingNow(person, now)).length,
    }),
    [view.people, now],
  )

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return view.people.filter((person) => {
      if (filter === 'ai' && !talkedToAi(person)) return false
      if (filter === 'paid' && !isPaid(person)) return false
      if (!needle) return true
      return [person.name, person.email, person.phone].some((field) => field?.toLowerCase().includes(needle))
    })
  }, [view.people, filter, query])

  const selected = view.people.find((person) => person.key === selectedKey) ?? null

  return (
    <PageViewport bottomPad={16}>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{view.offer.title}</h2>
            <p className="text-xs text-muted-foreground">Registrations, AI conversations and orders for this offer.</p>
          </div>
          <Link
            href={`/projects/${view.offer.id}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Offer settings
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Registered" value={counts.registered} />
          <Stat label="Talked to AI" value={counts.ai} />
          <Stat label="Paid" value={counts.paid} />
          <Stat label="Chatting now" value={counts.live} live />
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card">
          <aside
            className={cn(
              'min-h-0 w-full flex-col md:flex md:w-[340px] md:shrink-0 md:border-r md:border-border',
              selected ? 'hidden' : 'flex',
            )}
          >
            <div className="space-y-2 border-b border-border p-3">
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/50 p-1 text-xs">
                {(
                  [
                    ['all', `All ${view.people.length}`],
                    ['ai', `AI ${counts.ai}`],
                    ['paid', `Paid ${counts.paid}`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={cn(
                      'rounded-md px-2 py-1.5 transition-colors',
                      filter === key ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, email or phone"
                  className="h-9 pl-8 text-sm"
                  aria-label="Search people"
                />
              </div>
            </div>
            {visible.length ? (
              <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {visible.map((person) => (
                  <PersonRow
                    key={person.key}
                    person={person}
                    now={now}
                    selected={person.key === selectedKey}
                    onSelect={() => setSelectedKey(person.key)}
                  />
                ))}
              </ul>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
                <Users className="h-6 w-6" />
                {view.people.length
                  ? 'No one matches.'
                  : 'No one yet. People show up here when they open your share link or save a seat on your Live link.'}
              </div>
            )}
          </aside>

          <section className={cn('min-h-0 min-w-0 flex-1 flex-col', selected ? 'flex' : 'hidden md:flex')}>
            {selected ? (
              <Conversation view={view} person={selected} onBack={() => setSelectedKey(null)} />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
                <Bot className="h-7 w-7" />
                <p className="font-medium text-foreground">Pick someone to see what they said to your AI</p>
                <p className="max-w-sm">Chats update live. You can reply and the buyer sees it right in their chat.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </PageViewport>
  )
}
