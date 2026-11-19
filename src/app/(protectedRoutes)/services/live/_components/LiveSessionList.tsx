'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Radio } from 'lucide-react'
import type { LiveSession } from '@/lib/business/businessOffers'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

/** "in 2d 4h", "in 12m", or null once the start time has passed. */
function countdown(iso: string, now: number): string | null {
  const ms = new Date(iso).getTime() - now
  if (ms <= 0) return null
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor(ms / 3_600_000) % 24
  const minutes = Math.floor(ms / 60_000) % 60
  const seconds = Math.floor(ms / 1000) % 60
  if (days > 0) return `in ${days}d ${hours}h`
  if (hours > 0) return `in ${hours}h ${minutes}m`
  return `in ${minutes}m ${seconds}s`
}

/**
 * Upcoming sessions as visitors see them: local time, a live countdown and the Join link.
 * With onToggle, each session gets a "Show on website" switch.
 */
export function LiveSessionList({
  sessions,
  hiddenSlugs = [],
  onToggle,
}: {
  sessions: LiveSession[]
  hiddenSlugs?: string[]
  onToggle?: (slug: string, show: boolean) => void
}) {
  // Starts unset so server and browser render the same; the countdown appears after mount.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No upcoming sessions.{' '}
        <Link href="/projects" className="font-medium text-primary underline">
          Schedule a webinar in Projects
        </Link>{' '}
        and it shows up here.
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {sessions.map((session) => {
        const live = session.status === 'live'
        const left = now == null ? null : countdown(session.startsAt, now)
        const shown = !hiddenSlugs.includes(session.slug)
        return (
          <li
            key={session.slug}
            className={cn('space-y-2 rounded-xl border border-border/80 bg-muted/20 p-4', !shown && 'opacity-60')}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{session.title}</p>
                <p className="text-xs text-muted-foreground">
                  {now == null ? '…' : new Date(session.startsAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
              <span
                className={cn(
                  'flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                  live ? 'bg-red-500/15 text-red-500' : 'bg-muted text-muted-foreground',
                )}
              >
                {live ? <Radio className="h-3 w-3" aria-hidden /> : null}
                {live ? 'Live now' : session.status === 'waiting' ? 'Waiting room open' : (left ?? 'Starting soon')}
              </span>
            </div>
            {onToggle && session.joinUrl ? (
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={shown} onCheckedChange={(next) => onToggle(session.slug, next)} aria-label={`Show ${session.title} on website`} />
                Show on website
              </label>
            ) : null}
            {session.joinUrl ? (
              <a
                href={session.joinUrl}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {session.joinUrl.replace(/^https?:\/\//, '')}
                <ArrowUpRight className="h-3 w-3" aria-hidden />
              </a>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Not on your website yet: turn on “Live with you” for this webinar in Projects.
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
