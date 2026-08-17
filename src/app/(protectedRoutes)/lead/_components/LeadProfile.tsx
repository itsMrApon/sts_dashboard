'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  refreshLeadResearch,
  refreshLeadWebsiteScrape,
  runLeadPlaybookScore,
  runLeadScore,
  saveLeadDetails,
  saveLeadNotes,
  setLeadAgent,
} from '@/actions/callIntel'
import type { MeetingScoreDetail } from '@/lib/leads/scoreTypes'
import type { WebResearchDossier } from '@/lib/leads/webResearch'
import { normalizeWebsiteEnrichment } from '@/lib/leads/scrapeAgentClient'

export type { LeadProfileData, LeadProfileMeeting, LeadMeetingScore } from './leadProfileTypes'
import { cn } from '@/lib/utils'
import { ScoreEmptyState, ScoreResultPanel } from './ScoreResultPanel'
import { MeetingChat } from './MeetingChat'
import { LeadProfileSidebar } from './LeadProfileSidebar'
import type { LeadProfileData } from './leadProfileTypes'

type AgentOption = { id: string; name: string; systemPrompt: string | null }

type Props = {
  lead: LeadProfileData
  agents: AgentOption[]
  hasGeminiKey: boolean
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function formatWhen(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs font-medium">{title}</div>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-xs">None</p>
      ) : (
        <ul className="text-muted-foreground mt-1 list-disc space-y-1 pl-4 text-xs">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function LeadProfile(props: Props) {
  const { lead, agents, hasGeminiKey } = props
  const router = useRouter()
  const [notes, setNotes] = useState(lead.notes || '')
  const [emailDraft, setEmailDraft] = useState(
    lead.emailIsSynthetic ? '' : lead.email,
  )
  const [companyDraft, setCompanyDraft] = useState(lead.company || '')
  const [pending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState('research')
  const [chatSeed, setChatSeed] = useState<string | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [autoScrapeStatus, setAutoScrapeStatus] = useState<
    'idle' | 'scraping' | 'done' | 'error'
  >('idle')
  const [autoScrapeError, setAutoScrapeError] = useState<string | null>(null)
  const meetings = lead.meetings.length > 0
    ? lead.meetings
    : lead.meeting
      ? [lead.meeting]
      : []
  const [selectedMeetingId, setSelectedMeetingId] = useState(
    () => meetings[0]?.id || '',
  )
  const selectedMeeting =
    meetings.find((m) => m.id === selectedMeetingId) || meetings[0] || null
  const selectedScore = selectedMeeting?.score || null
  const meetingTrend = meetings
    .slice()
    .reverse()
    .map((m) => ({
      meetingId: m.id,
      label: new Date(m.recordedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      score: m.score?.overallScore ?? null,
    }))
  const research = lead.research as WebResearchDossier | null
  const websiteEnrichment = normalizeWebsiteEnrichment(
    research?.websiteEnrichment || null,
  )
  const playbookScore =
    research &&
    typeof research === 'object' &&
    'playbookScore' in research &&
    research.playbookScore
      ? (research.playbookScore as MeetingScoreDetail)
      : null
  const selectedAgent = agents.find((a) => a.id === lead.selectedAgentId)
  const meetingsCount = lead.meetings.length || (lead.meeting ? 1 : 0)
  const detailsDirty =
    emailDraft.trim().toLowerCase() !==
      (lead.emailIsSynthetic ? '' : lead.email.toLowerCase()) ||
    companyDraft.trim() !== (lead.company || '')

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = (e: MediaQueryListEvent) => {
      if (!e.matches) setProfileOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Business leads: page shows immediately; scrape runs in background.
  useEffect(() => {
    if (lead.source !== 'BUSINESS' || !lead.website?.trim()) return
    if (websiteEnrichment?.scrapedAt) {
      setAutoScrapeStatus('done')
      return
    }
    let cancelled = false
    setAutoScrapeStatus('scraping')
    setAutoScrapeError(null)
    ;(async () => {
      try {
        const { ensureLeadScrapeOnOpen } = await import('@/actions/callIntel')
        const res = await ensureLeadScrapeOnOpen(lead.id)
        if (cancelled) return
        if (res.ok && res.data?.scraped) {
          setAutoScrapeStatus('done')
          router.refresh()
        } else if (!res.ok) {
          setAutoScrapeStatus('error')
          setAutoScrapeError(res.error || 'Scrape failed')
        } else {
          // Already scraped or agent skipped
          setAutoScrapeStatus(websiteEnrichment?.scrapedAt ? 'done' : 'idle')
        }
      } catch {
        if (!cancelled) {
          setAutoScrapeStatus('error')
          setAutoScrapeError('Scrape failed')
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on open
  }, [lead.id])

  useEffect(() => {
    if (websiteEnrichment?.scrapedAt) setAutoScrapeStatus('done')
  }, [websiteEnrichment?.scrapedAt])

  function run(
    action: () => Promise<{
      ok: boolean
      error?: string
      data?: { leadId?: string }
    }>,
    okMsg: string,
  ) {
    startTransition(async () => {
      try {
        const res = await action()
        if (res.ok) {
          toast.success(okMsg)
          const nextId = res.data?.leadId
          if (nextId && nextId !== lead.id) {
            router.push(`/lead/${nextId}`)
          } else {
            router.refresh()
          }
        } else toast.error(res.error || 'Failed')
      } catch {
        toast.error('Connection lost. Check your internet and try again.')
      }
    })
  }

  function MeetingPicker() {
    if (meetings.length <= 1) return null
    return (
      <Select
        value={selectedMeeting?.id || meetings[0]?.id}
        onValueChange={setSelectedMeetingId}
      >
        <SelectTrigger className="h-9 max-w-md">
          <SelectValue placeholder="Select meeting" />
        </SelectTrigger>
        <SelectContent>
          {meetings.map((m, idx) => (
            <SelectItem key={m.id} value={m.id}>
              {formatWhen(m.recordedAt)}
              {m.score ? ' · Reviewed' : m.summary ? ' · Not reviewed' : ''}
              {idx === 0 ? ' · Latest' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="h-8 px-2">
          <Link href="/lead">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to list
          </Link>
        </Button>
        {!hasGeminiKey ? (
          <Button asChild size="sm" variant="secondary" className="h-8">
            <Link href="/ai-agents/config">Open Config Agent</Link>
          </Button>
        ) : null}
      </div>

      {/* Profile panel + tabs: collapsible on mobile (top), on desktop (left) */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Mobile: compact bar + slide-down panel */}
        <div className="shrink-0 lg:hidden">
          <button
            type="button"
            onClick={() => setProfileOpen((v) => !v)}
            className="bg-card hover:bg-muted/50 flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors"
            aria-expanded={profileOpen}
          >
            <Avatar className="size-9 shrink-0">
              <AvatarFallback className="text-sm">
                {initials(lead.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{lead.name}</p>
              <p className="text-muted-foreground truncate text-xs">
                {selectedAgent?.name || 'No agent'} · {meetingsCount} meetings
              </p>
            </div>
            {profileOpen ? (
              <ChevronUp className="text-muted-foreground size-4 shrink-0" />
            ) : (
              <ChevronDown className="text-muted-foreground size-4 shrink-0" />
            )}
          </button>
          <div
            className={cn(
              'overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out',
              profileOpen ? 'max-h-[min(70vh,520px)] opacity-100' : 'max-h-0 opacity-0',
            )}
          >
            <div className="pt-2 pb-1">
              <LeadProfileSidebar
                lead={lead}
                agents={agents}
                emailDraft={emailDraft}
                companyDraft={companyDraft}
                detailsDirty={detailsDirty}
                pending={pending}
                meetingsCount={meetingsCount}
                onEmailChange={setEmailDraft}
                onCompanyChange={setCompanyDraft}
                onSaveDetails={() =>
                  run(
                    () =>
                      saveLeadDetails(lead.id, {
                        email: emailDraft,
                        company: companyDraft,
                      }),
                    'Details saved',
                  )
                }
                onSetAgent={(agentId) =>
                  run(
                    () => setLeadAgent(lead.id, agentId),
                    'Agent updated',
                  )
                }
                initials={initials}
                formatWhen={formatWhen}
              />
            </div>
          </div>
        </div>

        {/* Desktop: left sidebar with width transition */}
        <div
          className={cn(
            'hidden min-h-0 shrink-0 overflow-hidden transition-[width,opacity] duration-300 ease-in-out lg:block',
            profileOpen ? 'w-[300px] opacity-100' : 'w-0 opacity-0',
          )}
        >
          <div className="h-full w-[300px]">
            <LeadProfileSidebar
              lead={lead}
              agents={agents}
              emailDraft={emailDraft}
              companyDraft={companyDraft}
              detailsDirty={detailsDirty}
              pending={pending}
              meetingsCount={meetingsCount}
              onEmailChange={setEmailDraft}
              onCompanyChange={setCompanyDraft}
              onSaveDetails={() =>
                run(
                  () =>
                    saveLeadDetails(lead.id, {
                      email: emailDraft,
                      company: companyDraft,
                    }),
                  'Details saved',
                )
              }
              onSetAgent={(agentId) =>
                run(() => setLeadAgent(lead.id, agentId), 'Agent updated')
              }
              initials={initials}
              formatWhen={formatWhen}
            />
          </div>
        </div>

        {/* Desktop toggle — sits on the seam / left edge of tabs */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            'absolute top-12 z-20 hidden size-7 rounded-full shadow-sm lg:inline-flex',
            profileOpen ? 'left-[288px]' : 'left-0',
          )}
          onClick={() => setProfileOpen((v) => !v)}
          aria-label={profileOpen ? 'Hide lead profile' : 'Show lead profile'}
        >
          {profileOpen ? (
            <PanelLeftClose className="size-3.5" />
          ) : (
            <PanelLeftOpen className="size-3.5" />
          )}
        </Button>

        {/* Tabs — primary content, gets all remaining space */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className={cn(
            'relative flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden lg:gap-3',
            !profileOpen && 'lg:pl-8',
          )}
        >
          <div className="shrink-0 overflow-x-auto">
            <TabsList className="bg-muted h-auto w-max min-w-full flex-wrap justify-start p-1">
              <TabsTrigger value="research">Web research</TabsTrigger>
              <TabsTrigger value="scrape">ScrapeGraphAI</TabsTrigger>
              <TabsTrigger value="score">
                {lead.kind === 'Business' ? 'Playbook fit' : 'Call review'}
              </TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="chat">Ask about call</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="research"
            className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
          >
            <Card className="h-full min-h-0 gap-0 overflow-hidden py-0 shadow-none">
              <CardHeader className="shrink-0 flex-row items-center justify-between gap-2 py-4">
                <CardTitle className="text-base">
                  {lead.kind === 'Business'
                    ? 'Web research (business)'
                    : lead.emailIsSynthetic
                      ? 'Web research (by name)'
                      : 'Web research'}
                </CardTitle>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    run(() => refreshLeadResearch(lead.id), 'Research updated')
                  }
                >
                  Refresh
                </Button>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-4 text-sm">
                {!research ? (
                  <p className="text-muted-foreground text-sm">
                    No dossier yet. Click Refresh to research this lead.
                  </p>
                ) : (
                  <>
                    {research.provider ? (
                      <p className="text-muted-foreground text-xs">
                        Via{' '}
                        {research.provider === 'gemini-grounding'
                          ? 'Gemini Search (free)'
                          : research.provider === 'serper'
                            ? 'Serper'
                            : research.provider === 'scrapegraph'
                              ? 'ScrapeGraphAI'
                              : 'model only'}
                        {websiteEnrichment?.scrapedAt
                          ? ' · website scraped'
                          : ''}
                      </p>
                    ) : null}
                    {research.locationGuess ? (
                      <p>Location guess: {research.locationGuess}</p>
                    ) : null}
                    {lead.website ? (
                      <p className="text-muted-foreground text-xs">
                        Website scrape lives in the ScrapeGraphAI tab
                        {websiteEnrichment?.scrapedAt
                          ? ` · last scraped ${formatWhen(websiteEnrichment.scrapedAt)}`
                          : ''}
                        .
                      </p>
                    ) : null}
                    <ListBlock title="Flags" items={research.flags || []} />
                    <ListBlock
                      title="Highlights"
                      items={research.highlights || []}
                    />
                    {(research.sources?.length ?? 0) > 0 ? (
                      <div>
                        <p className="mb-1 text-xs font-medium">Sources</p>
                        <ul className="list-disc space-y-1 pl-4 text-xs">
                          {research.sources.slice(0, 8).map((s) => (
                            <li key={s.link}>
                              <a
                                href={s.link}
                                target="_blank"
                                rel="noreferrer"
                                className="underline underline-offset-2"
                              >
                                {s.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                )}
                {lead.form ? (
                  <div className="border-t pt-3">
                    <p className="mb-1 text-xs font-medium">Project form</p>
                    <p className="text-sm">
                      {lead.form.name} · {lead.form.email}
                    </p>
                    <ul className="text-muted-foreground mt-1 list-disc pl-4 text-xs">
                      {lead.form.attendances.map((a) => (
                        <li key={`${a.webinarId}-${a.joinedAt}`}>
                          {a.title} ({a.kind}) — {a.attendedType}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent
            value="scrape"
            className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
          >
            <Card className="h-full min-h-0 gap-0 overflow-hidden py-0 shadow-none">
              <CardHeader className="shrink-0 flex-row items-center justify-between gap-2 py-4">
                <div>
                  <CardTitle className="text-base">ScrapeGraphAI</CardTitle>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Deep website scrape via the Python scrape agent
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={
                    pending ||
                    !lead.website ||
                    autoScrapeStatus === 'scraping'
                  }
                  onClick={() =>
                    run(
                      () => refreshLeadWebsiteScrape(lead.id),
                      'Website scrape updated',
                    )
                  }
                >
                  {autoScrapeStatus === 'scraping' ? (
                    <>
                      <Loader2 className="mr-1 size-3.5 animate-spin" />
                      Scraping…
                    </>
                  ) : websiteEnrichment ? (
                    'Re-scrape'
                  ) : (
                    'Scrape website'
                  )}
                </Button>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-4 text-sm">
                {!lead.website ? (
                  <p className="text-muted-foreground text-sm">
                    No website on this lead. Business/Google leads with a site
                    can be scraped here. Call summaries stay under Ask about
                    call.
                  </p>
                ) : autoScrapeStatus === 'scraping' && !websiteEnrichment ? (
                  <div className="flex items-start gap-3 rounded-lg border border-sky-500/30 bg-sky-500/5 p-4">
                    <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-sky-600" />
                    <div>
                      <p className="text-sm font-medium">
                        Scraping website in the background…
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        You can keep using this profile. Results will appear
                        here when the scrape finishes.
                      </p>
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs underline underline-offset-2"
                      >
                        {lead.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  </div>
                ) : !websiteEnrichment ? (
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-sm">
                      No scrape yet for{' '}
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2"
                      >
                        {lead.website.replace(/^https?:\/\//, '')}
                      </a>
                      .
                      {autoScrapeError
                        ? ` ${autoScrapeError}`
                        : ' Click Scrape website (requires scrape agent).'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="text-muted-foreground text-xs">
                      Scraped {formatWhen(websiteEnrichment.scrapedAt)}
                      {' · '}
                      {websiteEnrichment.provider || 'scrapegraph-ai'}
                    </div>
                    {websiteEnrichment.error ? (
                      <p className="text-destructive text-xs">
                        {websiteEnrichment.error}
                      </p>
                    ) : null}
                    {websiteEnrichment.companySummary ? (
                      <div>
                        <p className="mb-1 text-xs font-medium">
                          Company summary
                        </p>
                        <p className="text-sm whitespace-pre-wrap">
                          {websiteEnrichment.companySummary}
                        </p>
                      </div>
                    ) : null}
                    {(websiteEnrichment.services?.length ?? 0) > 0 ? (
                      <ListBlock
                        title="Services"
                        items={websiteEnrichment.services || []}
                      />
                    ) : null}
                    {(websiteEnrichment.contactEmails?.length ?? 0) >
                      0 ||
                    (websiteEnrichment.contactPhones?.length ?? 0) >
                      0 ? (
                      <div className="text-xs">
                        <p className="mb-1 font-medium">Contacts found</p>
                        <ul className="text-muted-foreground list-disc space-y-0.5 pl-4">
                          {(
                            websiteEnrichment.contactEmails || []
                          ).map((email) => (
                            <li key={email}>{email}</li>
                          ))}
                          {(
                            websiteEnrichment.contactPhones || []
                          ).map((phone) => (
                            <li key={phone}>{phone}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {(websiteEnrichment.socialLinks?.length ?? 0) >
                    0 ? (
                      <ListBlock
                        title="Social links"
                        items={websiteEnrichment.socialLinks || []}
                      />
                    ) : null}
                    {(websiteEnrichment.highlights?.length ?? 0) >
                    0 ? (
                      <ListBlock
                        title="Highlights"
                        items={websiteEnrichment.highlights || []}
                      />
                    ) : null}
                    {(websiteEnrichment.flags?.length ?? 0) > 0 ? (
                      <ListBlock
                        title="Flags"
                        items={websiteEnrichment.flags || []}
                      />
                    ) : null}
                    {!websiteEnrichment.companySummary &&
                    !(websiteEnrichment.services?.length ?? 0) &&
                    !(websiteEnrichment.highlights?.length ?? 0) &&
                    !(websiteEnrichment.contactEmails?.length ?? 0) ? (
                      <p className="text-muted-foreground text-sm">
                        Page loaded, but no structured company data was
                        extracted. Click Re-scrape after restarting the scrape
                        agent.
                      </p>
                    ) : null}
                    <a
                      href={websiteEnrichment.url || lead.website}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-xs underline underline-offset-2"
                    >
                      {(
                        websiteEnrichment.url || lead.website
                      ).replace(/^https?:\/\//, '')}
                    </a>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent
            value="score"
            className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
          >
            <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden border-0 py-0 shadow-none">
              <CardHeader className="shrink-0 space-y-3 border-b py-4">
                <div>
                  <CardTitle className="text-base font-medium">
                    {lead.kind === 'Business'
                      ? 'Playbook fit'
                      : 'Call review'}
                  </CardTitle>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {lead.kind === 'Business'
                      ? 'Compare scraped website intel to your AI agent prompt'
                      : 'How the conversation matched your sales playbook'}
                  </p>
                </div>
                {lead.kind === 'Business' ? null : <MeetingPicker />}
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 sm:px-6">
                {lead.kind === 'Business' ? (
                  playbookScore ? (
                    <ScoreResultPanel
                      className="min-h-0 flex-1"
                      score={playbookScore}
                      agentName={selectedAgent?.name || null}
                      pending={pending}
                      onAddToNotes={(text) => {
                        const next = notes.trim()
                          ? `${notes.trim()}\n\n---\n${text}`
                          : text
                        setNotes(next)
                        run(() => saveLeadNotes(lead.id, next), 'Notes updated')
                      }}
                      onAskAbout={(prompt) => {
                        setChatSeed(prompt)
                        setActiveTab('chat')
                      }}
                      onRunScore={() =>
                        run(
                          () => runLeadPlaybookScore(lead.id),
                          'Playbook fit updated',
                        )
                      }
                    />
                  ) : (
                    <div className="flex flex-col gap-4 py-8">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          Score scrape vs agent prompt
                        </p>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          {selectedAgent?.name
                            ? `We’ll compare ScrapeGraphAI results to “${selectedAgent.name}”.`
                            : 'Pick an AI agent rulebook in the lead profile first.'}
                          {!websiteEnrichment?.scrapedAt
                            ? ' Wait for (or run) a website scrape first.'
                            : ''}
                        </p>
                      </div>
                      {!hasGeminiKey ? (
                        <Button asChild size="sm" variant="outline">
                          <Link href="/ai-agents/config">Config Agent</Link>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            pending ||
                            !selectedAgent ||
                            !websiteEnrichment?.scrapedAt
                          }
                          onClick={() =>
                            run(
                              () => runLeadPlaybookScore(lead.id),
                              'Playbook fit ready',
                            )
                          }
                        >
                          Compare scrape to prompt
                        </Button>
                      )}
                    </div>
                  )
                ) : !selectedMeeting ? (
                  <ScoreEmptyState
                    agentName={selectedAgent?.name || null}
                    hasGeminiKey={hasGeminiKey}
                    hasMeeting={false}
                    pending={pending}
                    onRunScore={() => {}}
                  />
                ) : selectedScore ? (
                  <ScoreResultPanel
                    className="min-h-0 flex-1"
                    score={selectedScore}
                    scoreHistory={selectedMeeting.scoreHistory || []}
                    meetingTrend={meetingTrend}
                    agentName={selectedAgent?.name || null}
                    pending={pending}
                    onAddToNotes={(text) => {
                      const next = notes.trim()
                        ? `${notes.trim()}\n\n---\n${text}`
                        : text
                      setNotes(next)
                      run(() => saveLeadNotes(lead.id, next), 'Notes updated')
                    }}
                    onAskAbout={(prompt) => {
                      setChatSeed(prompt)
                      setActiveTab('chat')
                    }}
                    onRunScore={(deep) =>
                      run(
                        () =>
                          runLeadScore(selectedMeeting.id, {
                            deepScore: deep,
                          }),
                        'Review complete',
                      )
                    }
                  />
                ) : (
                  <ScoreEmptyState
                    agentName={selectedAgent?.name || null}
                    hasGeminiKey={hasGeminiKey}
                    hasMeeting={Boolean(selectedMeeting.summary)}
                    pending={pending}
                    onRunScore={(deep) =>
                      run(
                        () =>
                          runLeadScore(selectedMeeting.id, {
                            deepScore: deep,
                          }),
                        'Review complete',
                      )
                    }
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent
            value="notes"
            className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
          >
            <Card className="h-full min-h-0 gap-0 overflow-hidden py-0 shadow-none">
              <CardHeader className="shrink-0 py-4">
                <CardTitle className="text-base">Notes & history</CardTitle>
                {lead.outboundStatus ? (
                  <CardDescription className="capitalize">
                    Outbound: {lead.outboundStatus.replace('_', ' ').toLowerCase()}
                    {lead.nextFollowUpAt
                      ? ` · follow-up ${new Date(lead.nextFollowUpAt).toLocaleString()}`
                      : ''}
                  </CardDescription>
                ) : null}
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden pb-4">
                {(lead.activities?.length || 0) > 0 ? (
                  <ul className="max-h-36 shrink-0 space-y-2 overflow-y-auto rounded-lg border p-3 text-xs">
                    {lead.activities!.map((a) => (
                      <li key={a.id} className="border-b border-border/60 pb-2 last:border-0 last:pb-0">
                        <div className="font-medium">
                          {a.type.replace(/_/g, ' ').toLowerCase()}
                          <span className="text-muted-foreground ml-2 font-normal">
                            {new Date(a.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {a.note ? (
                          <p className="text-muted-foreground mt-0.5">{a.note}</p>
                        ) : null}
                        {a.meetLink ? (
                          <a
                            href={a.meetLink}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            Meet link
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Textarea
                  className="min-h-0 flex-1 resize-none"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Follow-up notes…"
                />
                <Button
                  size="sm"
                  className="shrink-0 self-start"
                  disabled={pending}
                  onClick={() =>
                    run(() => saveLeadNotes(lead.id, notes), 'Notes saved')
                  }
                >
                  Save notes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent
            value="chat"
            className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
          >
            <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden py-0 shadow-none">
              <CardHeader className="shrink-0 flex-row flex-wrap items-center justify-between gap-2 py-4">
                <CardTitle className="text-base">Ask about this call</CardTitle>
                <MeetingPicker />
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden pb-4">
                <MeetingChat
                  key={`${selectedMeeting?.id || 'none'}-${chatSeed || ''}`}
                  meetingId={selectedMeeting?.id || null}
                  meetingLabel={
                    selectedMeeting
                      ? formatWhen(selectedMeeting.recordedAt)
                      : null
                  }
                  hasGeminiKey={hasGeminiKey}
                  hasSummary={Boolean(selectedMeeting?.summary)}
                  seedPrompt={chatSeed}
                  onSeedConsumed={() => setChatSeed(null)}
                  noMeetingHint={
                    lead.kind === 'Business'
                      ? 'Business prospects have no call transcript. Use Web research and Notes instead.'
                      : null
                  }
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
