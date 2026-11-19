'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { CheckCircle2, Clock, Loader2, Radio } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAttendeeStore } from '@/store/useAttendeeStore'
import { forgetBuyer, getLiveStatus, joinLiveWaitlist } from '@/actions/buyer'
import type { BuyerContactView, PublicOfferView } from '@/lib/offers/publicOfferTypes'
import { LeadForm } from '@/app/(publicRoutes)/o/[slug]/_components/LeadForm'

type Props = {
  offer: PublicOfferView
  contact: BuyerContactView | null
  registered: boolean
  source: string
  /** The offer also has a share page (/o) to point to after the session. */
  hasSharePage: boolean
}

const STATUS_POLL_MS = 15_000

function useNow(): number | null {
  // Null until mounted, so server and client render the same markup.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

function splitDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl font-semibold tabular-nums sm:h-16 sm:w-16 sm:text-3xl">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  )
}

function calendarUrl(offer: PublicOfferView): string {
  const start = new Date(offer.startTime)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const link = typeof window === 'undefined' ? '' : `${window.location.origin}/live/${offer.slug}`
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${offer.title} (live)`,
    dates: `${stamp(start)}/${stamp(end)}`,
    details: `Join here: ${link}`,
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

export function LiveWaitingRoom({ offer, contact: initialContact, registered: initiallyRegistered, source, hasSharePage }: Props) {
  const router = useRouter()
  const { setAttendee, setEnteredProductId } = useAttendeeStore()
  const [contact, setContact] = useState(initialContact)
  const [registered, setRegistered] = useState(initiallyRegistered)
  const [status, setStatus] = useState(offer.webinarStatus)
  const [startTime, setStartTime] = useState(offer.startTime)
  const [busy, setBusy] = useState<'seat' | 'join' | 'forget' | null>(null)
  const now = useNow()
  const autoJoined = useRef(false)

  const startsAt = new Date(startTime).getTime()
  const left = now == null ? null : startsAt - now
  const isLive = status === 'LIVE'
  const isOver = status === 'ENDED' || status === 'CANCELLED'
  const pastStart = left != null && left <= 0

  const saveSeat = useCallback(async () => {
    const result = await joinLiveWaitlist({ slug: offer.slug })
    if (!result.ok) {
      toast.error(result.error)
      return false
    }
    setAttendee(result.attendee)
    setEnteredProductId(offer.id)
    setRegistered(true)
    setStatus(result.status)
    return true
  }, [offer.id, offer.slug, setAttendee, setEnteredProductId])

  const join = useCallback(async () => {
    setBusy('join')
    try {
      if (await saveSeat()) router.push(`/live/${offer.slug}/room`)
    } finally {
      setBusy(null)
    }
  }, [offer.slug, router, saveSeat])

  // Keep the status fresh so the doors open on their own when the creator goes live.
  useEffect(() => {
    if (isOver) return
    const poll = async () => {
      if (document.visibilityState !== 'visible') return
      const result = await getLiveStatus({ slug: offer.slug }).catch(() => null)
      if (result?.ok) {
        setStatus(result.status)
        setStartTime(result.startTime)
      }
    }
    const timer = window.setInterval(poll, STATUS_POLL_MS)
    return () => window.clearInterval(timer)
  }, [isOver, offer.slug])

  // Registered and waiting: walk them in as soon as the session is live.
  useEffect(() => {
    if (!isLive || !registered || autoJoined.current) return
    autoJoined.current = true
    toast.success(`${offer.business.name} is live. Taking you in…`)
    void join()
  }, [isLive, join, offer.business.name, registered])

  const notMe = async () => {
    setBusy('forget')
    try {
      await forgetBuyer({ slug: offer.slug })
      setContact(null)
      setRegistered(false)
    } finally {
      setBusy(null)
    }
  }

  const greeting = contact?.name || contact?.email || contact?.phone
  const parts = left != null ? splitDuration(left) : null

  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center px-4 py-10">
      <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-background">
        {offer.thumbnail ? (
          <Image src={offer.thumbnail} alt="" fill sizes="100vw" className="scale-110 object-cover opacity-40 blur-2xl" priority />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/25 via-background to-background" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
      </div>

      <div className="w-full max-w-md space-y-6 rounded-3xl border border-white/10 bg-card/70 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            {offer.business.logo ? (
              <Image src={offer.business.logo} alt="" width={24} height={24} unoptimized className="h-6 w-6 rounded-full object-cover" />
            ) : (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                {offer.business.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="truncate">{offer.business.name}</span>
          </div>
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
              isLive ? 'bg-red-500/15 text-red-400' : isOver ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary',
            )}
          >
            {isLive ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> : <Radio className="h-3.5 w-3.5" />}
            {isLive ? 'Live now' : isOver ? (status === 'CANCELLED' ? 'Cancelled' : 'Ended') : 'Live session'}
          </span>
        </div>

        <div className="space-y-2 text-center">
          <h1 className="text-balance text-2xl font-bold leading-tight sm:text-3xl">{offer.title}</h1>
          {now != null ? (
            <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {format(new Date(startTime), "EEEE, MMMM d 'at' h:mm a")}
            </p>
          ) : null}
        </div>

        {isOver ? (
          <div className="space-y-3 text-center text-sm text-muted-foreground">
            <p>{status === 'CANCELLED' ? 'This session was cancelled.' : 'This session has ended. Thanks for coming.'}</p>
            {hasSharePage ? (
              <Button asChild variant="outline" className="w-full">
                <Link href={`/o/${offer.slug}`}>See the offer</Link>
              </Button>
            ) : null}
          </div>
        ) : isLive ? (
          <p className="text-center text-sm text-muted-foreground">{offer.business.name} is live right now.</p>
        ) : parts && !pastStart ? (
          <div className="space-y-3">
            <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">Starts in</p>
            <div className="flex justify-center gap-2 sm:gap-3" role="timer" aria-live="off">
              {parts.days > 0 ? <CountdownUnit value={Math.min(parts.days, 99)} label="Days" /> : null}
              <CountdownUnit value={parts.hours} label="Hours" />
              <CountdownUnit value={parts.minutes} label="Min" />
              <CountdownUnit value={parts.seconds} label="Sec" />
            </div>
          </div>
        ) : pastStart ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Starting any minute. Waiting for {offer.business.name}…
          </div>
        ) : (
          <div className="h-[92px]" aria-hidden />
        )}

        {isOver ? null : !contact ? (
          <div className="space-y-3">
            <p className="text-center text-sm text-muted-foreground">
              {isLive ? 'Leave your email or WhatsApp to join.' : 'Save your seat. This page opens the doors when we go live.'}
            </p>
            <LeadForm
              slug={offer.slug}
              source={source}
              submitLabel={isLive ? 'Join now' : 'Save my seat'}
              onCaptured={async (captured) => {
                setContact(captured)
                if (isLive) await join()
                else await saveSeat()
              }}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {registered && !isLive ? (
              <div className="flex items-start gap-3 rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                <p>
                  You&apos;re on the list, <span className="font-medium">{greeting}</span>. Keep this page open, or come back at
                  start time.
                </p>
              </div>
            ) : null}

            {isLive ? (
              <Button className="w-full" size="lg" onClick={() => void join()} disabled={busy === 'join'}>
                {busy === 'join' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-current" />}
                Join now
              </Button>
            ) : !registered ? (
              <Button
                className="w-full"
                onClick={async () => {
                  setBusy('seat')
                  try {
                    await saveSeat()
                  } finally {
                    setBusy(null)
                  }
                }}
                disabled={busy === 'seat'}
              >
                {busy === 'seat' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save my seat as {greeting}
              </Button>
            ) : null}

            {registered && !isLive && now != null ? (
              <Button asChild variant="outline" className="w-full">
                <a href={calendarUrl({ ...offer, startTime })} target="_blank" rel="noreferrer">
                  Add to Google Calendar
                </a>
              </Button>
            ) : null}

            <button
              type="button"
              onClick={() => void notMe()}
              disabled={busy === 'forget'}
              className="block w-full text-center text-xs text-muted-foreground underline underline-offset-2"
            >
              Not {greeting}?
            </button>
          </div>
        )}

        {offer.description && !isOver ? (
          <p className="whitespace-pre-line border-t border-white/10 pt-4 text-sm text-muted-foreground">{offer.description}</p>
        ) : null}
      </div>
    </main>
  )
}
