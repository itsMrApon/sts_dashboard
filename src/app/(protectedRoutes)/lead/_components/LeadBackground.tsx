'use client'

import { useState, type ReactNode } from 'react'
import { motion, type Variants } from 'motion/react'
import { ArrowUpRight, Check, Globe, Mail, Phone, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { detectSocialProfile } from '@/lib/business/socialLinks'
import type { MeetingScoreDetail } from '@/lib/leads/scoreTypes'
import type { WebResearchDossier, WebsiteEnrichmentSnapshot } from '@/lib/leads/webResearch'
import { cn } from '@/lib/utils'
import type { LeadProfileData, LeadProfileMeeting } from './leadProfileTypes'
import { ImportCallNotes } from './ImportCallNotes'

/**
 * The bottom of a lead's page: who they are, in one place. Research and the website scan are
 * merged into a short profile (about, what they offer, signals, how they fit), with where to find
 * them and your notes on the side. No provider names, no instructions, no tabs.
 */

type Props = {
  lead: LeadProfileData
  businessName: string
  research: WebResearchDossier | null
  scan: Pick<
    WebsiteEnrichmentSnapshot,
    'companySummary' | 'services' | 'contactEmails' | 'contactPhones' | 'socialLinks' | 'highlights' | 'flags' | 'scrapedAt'
  > | null
  fit: MeetingScoreDetail | null
  fitLabel: string
  /** The full scoring breakdown, shown on request. */
  fitDetails: ReactNode
  preparing: boolean
  prepareError: string | null
  pending: boolean
  onRefresh: () => void
  notes: string
  onNotesChange: (value: string) => void
  onSaveNotes: () => void
  /** "Ask about the call", for leads that have had one. */
  chat: ReactNode
  /** Recorded (Fathom) and imported calls, newest first. */
  meetings: LeadProfileMeeting[]
}

const GRADE: Record<MeetingScoreDetail['grade'], string> = {
  Strong: 'Strong fit',
  'Needs coaching': 'Partial fit',
  'Off-script': 'Weak fit',
}

const container: Variants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } }
const item: Variants = {
  hidden: { y: 12, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 140, damping: 20 } },
}

const norm = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** Unique lines, without ones that repeat the summary or are about our own tooling. */
function uniqueLines(lists: Array<string[] | undefined>, skip: string[] = []): string[] {
  const seen = new Set(skip.map(norm))
  const out: string[] = []
  for (const line of lists.flat()) {
    const text = line?.trim()
    if (!text || /scrape unavailable|scrape agent|playwright/i.test(text)) continue
    const key = norm(text)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out
}

const shortDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null

function Label({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
      {children}
      {count !== undefined ? <span className="ml-1.5 text-foreground">{String(count).padStart(2, '0')}</span> : null}
    </p>
  )
}

function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2.5" aria-hidden>
      {Array.from({ length: lines }, (_, index) => (
        <div key={index} className="h-4 animate-pulse rounded bg-muted/60" style={{ width: `${92 - index * 14}%` }} />
      ))}
    </div>
  )
}

/** A short list that can open to show the rest. */
function Signals({ title, lines, tone }: { title: string; lines: string[]; tone: 'good' | 'watch' }) {
  const [open, setOpen] = useState(false)
  const shown = open ? lines : lines.slice(0, 4)
  return (
    <div className="space-y-3">
      <Label count={lines.length}>{title}</Label>
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">None found</p>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((line) => (
            <li key={line} className="flex gap-2.5 text-sm leading-relaxed">
              <span
                className={cn(
                  'mt-2 size-1.5 shrink-0 rounded-full',
                  tone === 'good' ? 'bg-emerald-400' : 'bg-amber-400',
                )}
              />
              <span className="text-foreground/85">{line}</span>
            </li>
          ))}
        </ul>
      )}
      {lines.length > 4 ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="font-mono text-[11px] text-muted-foreground hover:text-foreground"
        >
          {open ? 'Show less' : `+${lines.length - 4} more`}
        </button>
      ) : null}
    </div>
  )
}

/** The fit score as a ring. */
function ScoreRing({ score }: { score: number }) {
  const radius = 34
  const length = 2 * Math.PI * radius
  const tone = score >= 70 ? 'text-emerald-400' : score >= 45 ? 'text-amber-400' : 'text-rose-400'
  return (
    <div className="relative size-24 shrink-0">
      <svg viewBox="0 0 80 80" className="size-24 -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r={radius} className="fill-none stroke-muted" strokeWidth="6" />
        <motion.circle
          cx="40"
          cy="40"
          r={radius}
          className={cn('fill-none stroke-current', tone)}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={length}
          initial={{ strokeDashoffset: length }}
          animate={{ strokeDashoffset: length * (1 - Math.min(Math.max(score, 0), 100) / 100) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-2xl font-semibold tabular-nums">{score}</span>
    </div>
  )
}

function host(url: string) {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function LeadBackground(props: Props) {
  const { lead, research, scan, fit } = props
  const [showDetails, setShowDetails] = useState(false)

  // Their own website's description first; without one, the strongest thing the web says.
  const about = scan?.companySummary?.trim() || research?.highlights?.find((line) => line.trim().length > 40)?.trim() || null
  const services = uniqueLines([scan?.services])
  const good = uniqueLines([scan?.highlights, research?.highlights], about ? [about] : [])
  const watch = uniqueLines([scan?.flags, research?.flags])
  const phones = uniqueLines([lead.phone ? [lead.phone] : [], scan?.contactPhones])
  const emails = uniqueLines([lead.emailIsSynthetic ? [] : [lead.email], scan?.contactEmails])
  const socials = (scan?.socialLinks ?? [])
    .map((link) => ({ link, profile: detectSocialProfile(link) }))
    .filter((entry, index, all) => all.findIndex((other) => other.link === entry.link) === index)
  const sources = (research?.sources ?? []).filter((source) => source.link).slice(0, 5)
  const updated = shortDate(scan?.scrapedAt || research?.generatedAt)
  const nothingYet = !about && good.length === 0 && services.length === 0

  return (
    <motion.section initial="hidden" animate="visible" variants={container} className="mx-auto w-full max-w-5xl">
      {/* Header */}
      <motion.div
        variants={item}
        className="flex items-end justify-between gap-3 border-b border-dashed border-border/70 pb-3"
      >
        <div className="space-y-1">
          <h2 className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Background</h2>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            {props.preparing ? (
              <>
                <span className="size-1.5 animate-pulse rounded-full bg-violet-400" />
                Reading their background…
              </>
            ) : props.prepareError && nothingYet ? (
              props.prepareError
            ) : updated ? (
              `Updated ${updated}`
            ) : (
              'Nothing gathered yet'
            )}
          </p>
        </div>
        <Button variant="ghost" size="sm" disabled={props.pending || props.preparing} onClick={props.onRefresh}>
          Refresh
        </Button>
      </motion.div>

      <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-10">
          {/* About */}
          <motion.div variants={item} className="space-y-3">
            <Label>About</Label>
            {about ? (
              <p className="max-w-2xl text-xl leading-relaxed text-foreground/90 text-pretty">{about}</p>
            ) : props.preparing ? (
              <Skeleton />
            ) : (
              <p className="text-muted-foreground">
                {lead.website ? 'Their website has not been read yet.' : 'Nothing known about them yet.'}
              </p>
            )}
          </motion.div>

          {/* What they offer */}
          {services.length > 0 ? (
            <motion.div variants={item} className="space-y-3">
              <Label count={services.length}>What they offer</Label>
              <div className="flex flex-wrap gap-2">
                {services.map((service) => (
                  <span key={service} className="rounded-full bg-muted/50 px-3 py-1 text-sm">
                    {service}
                  </span>
                ))}
              </div>
            </motion.div>
          ) : null}

          {/* Signals */}
          <motion.div variants={item} className="grid gap-8 sm:grid-cols-2">
            {props.preparing && good.length === 0 ? (
              <>
                <Skeleton lines={4} />
                <Skeleton lines={3} />
              </>
            ) : (
              <>
                <Signals title="Good signs" lines={good} tone="good" />
                <Signals title="Watch out" lines={watch} tone="watch" />
              </>
            )}
          </motion.div>

          {/* Fit */}
          <motion.div variants={item} className="space-y-4 border-t border-border/60 pt-8">
            <Label>{props.fitLabel}</Label>
            {fit ? (
              <>
                <div className="flex flex-wrap items-center gap-6">
                  <ScoreRing score={fit.overallScore} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-lg font-semibold">{GRADE[fit.grade]}</p>
                    <p className="text-sm text-muted-foreground">Compared with what {props.businessName} sells.</p>
                  </div>
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  <ul className="space-y-2">
                    {fit.covered.slice(0, 3).map((line) => (
                      <li key={line} className="flex gap-2 text-sm leading-relaxed">
                        <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden />
                        <span className="text-foreground/85">{line}</span>
                      </li>
                    ))}
                  </ul>
                  <ul className="space-y-2">
                    {fit.missed.slice(0, 3).map((line) => (
                      <li key={line} className="flex gap-2 text-sm leading-relaxed">
                        <X className="mt-0.5 size-4 shrink-0 text-rose-400" aria-hidden />
                        <span className="text-foreground/85">{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDetails((value) => !value)}
                  className="font-mono text-[11px] text-muted-foreground hover:text-foreground"
                  aria-expanded={showDetails}
                >
                  {showDetails ? 'Hide the full checklist' : 'See the full checklist'}
                </button>
                {showDetails ? <div className="flex h-[60vh] min-h-[440px] flex-col">{props.fitDetails}</div> : null}
              </>
            ) : props.preparing ? (
              <Skeleton lines={2} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {lead.kind !== 'Business'
                  ? 'Scored once a call has been recorded.'
                  : lead.website
                    ? 'Scored as soon as their website has been read.'
                    : 'Scored from what the web says about them.'}
              </p>
            )}
          </motion.div>

          {/* Calls */}
          <motion.div variants={item} className="space-y-4 border-t border-border/60 pt-8">
            <div className="flex items-center justify-between gap-3">
              <Label count={props.meetings.length}>Calls</Label>
              <ImportCallNotes leadId={lead.id} businessName={props.businessName} />
            </div>
            {props.meetings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No calls yet. Fathom calls show up here by themselves; for calls without a bot, import the notes.
              </p>
            ) : (
              <ol className="divide-y divide-border/40">
                {props.meetings.map((meeting) => {
                  const preview = (meeting.summary || '')
                    .split('\n')
                    .map((line) => line.replace(/^[#>*\-\s]+/, '').trim())
                    .find((line) => line.length > 0)
                  const score = meeting.score?.overallScore
                  return (
                    <li key={meeting.id} className="flex items-start gap-4 py-3">
                      <div className="w-16 shrink-0 font-mono text-xs text-muted-foreground">
                        {shortDate(meeting.recordedAt)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{preview || 'No notes'}</p>
                        <p className="mt-0.5 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                          {meeting.imported ? 'Imported' : 'Fathom'}
                        </p>
                      </div>
                      {score != null ? (
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 font-mono text-xs tabular-nums',
                            score >= 70
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : score >= 45
                                ? 'bg-amber-500/15 text-amber-300'
                                : 'bg-rose-500/15 text-rose-300',
                          )}
                        >
                          {score}
                        </span>
                      ) : (
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">not reviewed</span>
                      )}
                    </li>
                  )
                })}
              </ol>
            )}
          </motion.div>
        </div>

        {/* Side: where to find them, and notes */}
        <motion.aside variants={item} className="space-y-10">
          <div className="space-y-3">
            <Label>Find them</Label>
            <ul className="space-y-2.5 text-sm">
              {lead.website ? (
                <li>
                  <a
                    href={/^https?:\/\//i.test(lead.website) ? lead.website : `https://${lead.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 hover:underline"
                  >
                    <Globe className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate">{host(lead.website)}</span>
                  </a>
                </li>
              ) : null}
              {phones.map((phone) => (
                <li key={phone}>
                  <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-2 hover:underline">
                    <Phone className="size-3.5 shrink-0 text-sky-400" aria-hidden />
                    {phone}
                  </a>
                </li>
              ))}
              {emails.map((email) => (
                <li key={email}>
                  <a href={`mailto:${email}`} className="flex min-w-0 items-center gap-2 hover:underline">
                    <Mail className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate">{email}</span>
                  </a>
                </li>
              ))}
              {socials.map(({ link, profile }) => (
                <li key={link}>
                  <a
                    href={profile?.url || link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-2 hover:underline"
                  >
                    <span className="truncate">
                      <span className="capitalize">{profile?.platform ?? host(link)}</span>
                      {profile ? <span className="text-muted-foreground"> · {profile.handle}</span> : null}
                    </span>
                    <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  </a>
                </li>
              ))}
              {!lead.website && phones.length === 0 && emails.length === 0 && socials.length === 0 ? (
                <li className="text-muted-foreground">Nothing found yet</li>
              ) : null}
            </ul>
            {sources.length > 0 ? (
              <div className="space-y-2 pt-3">
                <Label count={sources.length}>Mentioned on</Label>
                <ul className="space-y-1.5 text-sm">
                  {sources.map((source) => (
                    <li key={source.link}>
                      <a
                        href={source.link}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-2 text-muted-foreground hover:text-foreground"
                      >
                        <span className="truncate">{host(source.link)}</span>
                        <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Your notes</Label>
              <Button variant="ghost" size="sm" disabled={props.pending} onClick={props.onSaveNotes}>
                Save
              </Button>
            </div>
            <Textarea
              rows={6}
              value={props.notes}
              onChange={(event) => props.onNotesChange(event.target.value)}
              placeholder="What they need, what to say next…"
              className="min-h-[140px] resize-y bg-muted/20"
            />
            {(lead.activities?.length || 0) > 0 ? (
              <ol className="relative mt-4 space-y-4 border-l border-border/60 pl-4">
                {lead.activities!.map((activity) => (
                  <li key={activity.id} className="relative">
                    <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-violet-400 ring-4 ring-background" />
                    <p className="text-sm font-medium capitalize">{activity.type.replace(/_/g, ' ').toLowerCase()}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{shortDate(activity.createdAt)}</p>
                    {activity.note ? <p className="mt-1 text-sm text-muted-foreground">{activity.note}</p> : null}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        </motion.aside>
      </div>

      {props.chat ? (
        <motion.div variants={item} className="mt-12 space-y-4 border-t border-dashed border-border/70 pt-6">
          <Label>Ask about the call</Label>
          <div className="flex h-[60vh] min-h-[420px] flex-col">{props.chat}</div>
        </motion.div>
      ) : null}
    </motion.section>
  )
}
