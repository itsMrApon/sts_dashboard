'use client'

import Link from 'next/link'
import { motion, type Variants } from 'motion/react'
import { Globe, Mail, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DetailBreadcrumbs, DetailFact, DetailStamp } from '@/components/ui/project-detail-view'
import { cn } from '@/lib/utils'
import type { LeadProfileData } from './leadProfileTypes'

/**
 * The top of a lead's page, in the same "case file" style as /lead: breadcrumb, name with a stamped
 * status, a strip of how far the lead has got, and a fact sheet whose company and email can be
 * edited in place.
 */

type Props = {
  lead: LeadProfileData
  hasGeminiKey: boolean
  researched: boolean
  scanned: boolean
  /** Playbook fit or call score out of 100. */
  score: number | null
  meetingsCount: number
  emailDraft: string
  companyDraft: string
  detailsDirty: boolean
  pending: boolean
  onEmailChange: (value: string) => void
  onCompanyChange: (value: string) => void
  onSaveDetails: () => void
}

const OUTBOUND_STAMP = { NEW: 'New', ON_PROCESS: 'In progress', DONE: 'Done' } as const

const shortDate = (value: string | null | undefined) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const container: Variants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.07 } } }
const item: Variants = {
  hidden: { y: 12, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 140, damping: 20 } },
}

export function LeadCaseFile(props: Props) {
  const { lead } = props
  const isBusiness = lead.kind === 'Business'
  const contacted = lead.outboundStatus === 'ON_PROCESS' || lead.outboundStatus === 'DONE' || Boolean(lead.activities?.length)

  // How far the lead has got; the first step not reached is "next".
  const stages = [
    { label: 'Found', done: true },
    { label: 'Researched', done: props.researched },
    ...(isBusiness && lead.website ? [{ label: 'Site scanned', done: props.scanned }] : []),
    { label: 'Contacted', done: contacted },
    { label: 'Met', done: props.meetingsCount > 0 },
    { label: 'Scored', done: props.score !== null },
    { label: 'Done', done: lead.outboundStatus === 'DONE' },
  ]
  const nextIndex = stages.findIndex((stage) => !stage.done)

  const stamp = lead.outboundStatus ? OUTBOUND_STAMP[lead.outboundStatus] : lead.status
  const website = lead.website?.trim() || null
  const email = lead.emailIsSynthetic ? null : lead.email
  const followUp = shortDate(lead.nextFollowUpAt)
  const lastCall = shortDate(lead.meeting?.recordedAt || lead.lastAppointmentAt)
  return (
    <motion.section initial="hidden" animate="visible" variants={container} className="mx-auto w-full max-w-5xl">
      {/* Breadcrumb and actions */}
      <motion.header
        variants={item}
        className="flex items-center justify-between gap-3 border-b border-dashed border-border/70 pb-3"
      >
        <DetailBreadcrumbs
          items={[
            { label: 'Leads', href: '/lead' },
            { label: 'List', href: '/lead/list' },
            { label: lead.name, href: `/lead/${lead.id}` },
          ]}
        />
        {!props.hasGeminiKey ? (
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <Link href="/ai-agents/config">Add an AI key</Link>
          </Button>
        ) : null}
      </motion.header>

      {/* Name and status */}
      <motion.div variants={item} className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pt-7">
        <div className="min-w-0 space-y-2">
          <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
            {isBusiness ? 'Business lead' : `${lead.kind} lead`}
            {lead.maps?.category ? ` · ${lead.maps.category}` : ''}
            {lead.company && lead.company !== lead.name ? ` · ${lead.company}` : ''}
          </p>
          <h1 className="text-3xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl">{lead.name}</h1>
        </div>
        <DetailStamp>{stamp}</DetailStamp>
      </motion.div>

      {/* Stage strip */}
      <motion.ol variants={item} className="mt-6 grid gap-1" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
        {stages.map((stage, index) => (
          <li key={stage.label} className="min-w-0 space-y-1.5">
            <span
              className={cn(
                'block h-2 rounded-full',
                stage.done ? 'bg-violet-400' : index === nextIndex ? 'animate-pulse bg-violet-400/40' : 'bg-muted',
              )}
            />
            <span
              className={cn(
                'block truncate font-mono text-[10px] tracking-wide',
                stage.done ? 'text-foreground' : index === nextIndex ? 'text-violet-300' : 'text-muted-foreground',
              )}
            >
              {stage.label}
            </span>
          </li>
        ))}
      </motion.ol>

      {/* Fact sheet */}
      <motion.div
        variants={item}
        className="mt-7 grid grid-cols-2 gap-x-6 gap-y-6 border-y border-border/60 py-6 lg:grid-cols-4"
      >
        <DetailFact label="Contact" className="col-span-2 lg:col-span-1">
          <div className="space-y-1.5">
            {lead.phone ? (
              <a href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-2 font-medium hover:underline">
                <Phone className="size-3.5 text-sky-400" aria-hidden />
                {lead.phone}
              </a>
            ) : null}
            {email ? (
              <a href={`mailto:${email}`} className="flex min-w-0 items-center gap-2 hover:underline">
                <Mail className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{email}</span>
              </a>
            ) : null}
            {website ? (
              <a
                href={/^https?:\/\//i.test(website) ? website : `https://${website}`}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center gap-2 hover:underline"
              >
                <Globe className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</span>
              </a>
            ) : null}
            {!lead.phone && !email && !website ? <span className="text-muted-foreground">No contact yet</span> : null}
          </div>
        </DetailFact>
        <DetailFact label="Address" className="col-span-2 lg:col-span-1">
          <p className={cn('leading-snug', !lead.address && 'text-muted-foreground')}>{lead.address || 'Not known'}</p>
        </DetailFact>
        {lead.maps?.rating != null && !followUp && !lastCall ? (
          <DetailFact label="Google rating">
            <p className="font-medium">
              <span className="text-amber-300">★</span> {lead.maps.rating.toFixed(1)}
              {lead.maps.reviews != null ? (
                <span className="font-normal text-muted-foreground">
                  {' '}· {lead.maps.reviews} review{lead.maps.reviews === 1 ? '' : 's'}
                </span>
              ) : null}
            </p>
          </DetailFact>
        ) : (
          <DetailFact label={followUp ? 'Follow-up' : 'Last call'}>
            <p className="font-medium">{followUp || lastCall || <span className="font-normal text-muted-foreground">None yet</span>}</p>
          </DetailFact>
        )}
        <DetailFact label={isBusiness ? 'Playbook fit' : 'Call score'}>
          {props.score !== null ? (
            <p className="font-medium">
              <span className="text-2xl font-semibold tabular-nums">{props.score}</span>
              <span className="text-muted-foreground"> / 100</span>
            </p>
          ) : (
            <p className="text-muted-foreground">Not scored</p>
          )}
        </DetailFact>


        {/* Editable details */}
        <DetailFact label="Company">
          <Input
            value={props.companyDraft}
            placeholder="Add company…"
            disabled={props.pending}
            onChange={(event) => props.onCompanyChange(event.target.value)}
            aria-label="Company"
          />
        </DetailFact>
        {isBusiness ? null : (
          <DetailFact label="Email">
            <Input
              type="email"
              value={props.emailDraft}
              placeholder="Add guest email…"
              disabled={props.pending}
              onChange={(event) => props.onEmailChange(event.target.value)}
              aria-label="Email"
            />
          </DetailFact>
        )}
        {props.detailsDirty ? (
          <div className="flex items-end">
            <Button size="sm" disabled={props.pending} onClick={props.onSaveDetails}>
              Save details
            </Button>
          </div>
        ) : null}
      </motion.div>
    </motion.section>
  )
}
