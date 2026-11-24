'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from '@/lib/toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  prepareLeadOnOpen,
  refreshLeadResearch,
  runLeadPlaybookScore,
  runLeadScore,
  saveLeadDetails,
  saveLeadNotes,
} from '@/actions/callIntel'
import type { MeetingScoreDetail } from '@/lib/leads/scoreTypes'
import type { WebResearchDossier } from '@/lib/leads/webResearch'
import { normalizeWebsiteEnrichment } from '@/lib/leads/scrapeAgentClient'

export type { LeadProfileData, LeadProfileMeeting, LeadMeetingScore } from './leadProfileTypes'
import { ScoreResultPanel } from './ScoreResultPanel'
import { MeetingChat } from './MeetingChat'
import { LeadCaseFile } from './LeadCaseFile'
import { LeadBackground } from './LeadBackground'
import type { LeadProfileData } from './leadProfileTypes'
import { guardAction } from '@/lib/clientActionErrors'


type Props = {
  lead: LeadProfileData
  /** Leads are scored against this business's own data (its playbook). */
  businessName: string
  hasGeminiKey: boolean
}

function formatWhen(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

/** The scan worker's errors in plain words (it returns Python/Playwright text). */
function scanErrorMessage(raw: string | null): string | null {
  if (!raw) return null
  if (/not running|ECONNREFUSED|fetch failed/i.test(raw)) return "The website reader isn't running on this server."
  if (/Executable doesn't exist|playwright install/i.test(raw)) return "The website reader's browser isn't installed on this server."
  if (/timed? ?out/i.test(raw)) return 'The website took too long to answer.'
  return 'The website could not be read.'
}

export function LeadProfile(props: Props) {
  const { lead, businessName, hasGeminiKey } = props
  const router = useRouter()
  const [notes, setNotes] = useState(lead.notes || '')
  const [emailDraft, setEmailDraft] = useState(
    lead.emailIsSynthetic ? '' : lead.email,
  )
  const [companyDraft, setCompanyDraft] = useState(lead.company || '')
  const [pending, startTransition] = useTransition()
  const [chatSeed, setChatSeed] = useState<string | null>(null)
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
  const meetingsCount = lead.meetings.length || (lead.meeting ? 1 : 0)
  const detailsDirty =
    emailDraft.trim().toLowerCase() !==
      (lead.emailIsSynthetic ? '' : lead.email.toLowerCase()) ||
    companyDraft.trim() !== (lead.company || '')

  // Opening a lead fills in what is missing (research, website scan, fit or call review), then
  // refreshes. Nothing to press.
  const [preparing, setPreparing] = useState(false)
  const [prepareError, setPrepareError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    const missingResearch = !research?.generatedAt
    const missingScan = lead.source === 'BUSINESS' && Boolean(lead.website?.trim()) && !websiteEnrichment?.scrapedAt
    const missingFit =
      lead.kind === 'Business'
        ? (Boolean(websiteEnrichment?.scrapedAt) || (!lead.website && Boolean(research?.highlights?.length))) && !playbookScore
        : Boolean(meetings[0]?.summary) && !meetings[0]?.score
    if (!missingResearch && !missingScan && !missingFit) return
    setPreparing(true)
    setPrepareError(null)
    ;(async () => {
      try {
        const res = await prepareLeadOnOpen(lead.id)
        if (cancelled) return
        if (!res.ok) setPrepareError(scanErrorMessage(res.error))
        else {
          if (res.data?.error) setPrepareError(scanErrorMessage(res.data.error))
          if (res.data?.ran.length) router.refresh()
        }
      } catch {
        if (!cancelled) setPrepareError('Could not read their background right now.')
      } finally {
        if (!cancelled) setPreparing(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per lead
  }, [lead.id])

  function run(
    action: () => Promise<{
      ok: boolean
      error?: string
      data?: { leadId?: string }
    }>,
    okMsg: string,
  ) {
    startTransition(guardAction(async () => {
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
    }))
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

  const showChat = meetings.length > 0
  const addToNotes = (text: string) => {
    const next = notes.trim() ? `${notes.trim()}\n\n---\n${text}` : text
    setNotes(next)
    run(() => saveLeadNotes(lead.id, next), 'Notes updated')
  }
  const askAbout = (prompt: string) => {
    setChatSeed(prompt)
    document.getElementById('lead-call-chat')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex flex-col gap-8 pb-6">
      <LeadCaseFile
        lead={lead}
        hasGeminiKey={hasGeminiKey}
        researched={Boolean(research && (research.highlights?.length || research.sources?.length || research.generatedAt))}
        scanned={Boolean(websiteEnrichment?.scrapedAt)}
        score={
          playbookScore?.overallScore ??
          selectedScore?.overallScore ??
          null
        }
        meetingsCount={meetingsCount}
        emailDraft={emailDraft}
        companyDraft={companyDraft}
        detailsDirty={detailsDirty}
        pending={pending}
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
      />

      <LeadBackground
        lead={lead}
        businessName={businessName}
        research={research}
        scan={websiteEnrichment}
        fit={lead.kind === 'Business' ? playbookScore : selectedScore}
        fitLabel={lead.kind === 'Business' ? `Fit with ${businessName}` : 'Call review'}
        fitDetails={
          lead.kind === 'Business' ? (
            playbookScore ? (
              <ScoreResultPanel
                className="min-h-0 flex-1"
                score={playbookScore}
                agentName={businessName}
                scoreLabel="Fit score"
                pending={pending}
                onAddToNotes={addToNotes}
                onAskAbout={askAbout}
                onRunScore={() => run(() => runLeadPlaybookScore(lead.id), 'Fit updated')}
              />
            ) : null
          ) : selectedMeeting && selectedScore ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <MeetingPicker />
              <ScoreResultPanel
                className="min-h-0 flex-1"
                score={selectedScore}
                scoreHistory={selectedMeeting.scoreHistory || []}
                meetingTrend={meetingTrend}
                agentName={businessName}
                pending={pending}
                onAddToNotes={addToNotes}
                onAskAbout={askAbout}
                onRunScore={(deep) =>
                  run(() => runLeadScore(selectedMeeting.id, { deepScore: deep }), 'Review complete')
                }
              />
            </div>
          ) : null
        }
        preparing={preparing}
        prepareError={prepareError}
        pending={pending}
        onRefresh={() =>
          run(async () => {
            const research = await refreshLeadResearch(lead.id)
            if (!research.ok) return research
            return lead.kind === 'Business' ? runLeadPlaybookScore(lead.id) : research
          }, 'Background updated')
        }
        meetings={meetings}
        notes={notes}
        onNotesChange={setNotes}
        onSaveNotes={() => run(() => saveLeadNotes(lead.id, notes), 'Notes saved')}
        chat={
          showChat ? (
            <div id="lead-call-chat" className="flex min-h-0 flex-1 flex-col gap-3">
              <MeetingPicker />
              <MeetingChat
                key={`${selectedMeeting?.id || 'none'}-${chatSeed || ''}`}
                meetingId={selectedMeeting?.id || null}
                meetingLabel={selectedMeeting ? formatWhen(selectedMeeting.recordedAt) : null}
                hasGeminiKey={hasGeminiKey}
                hasSummary={Boolean(selectedMeeting?.summary)}
                seedPrompt={chatSeed}
                onSeedConsumed={() => setChatSeed(null)}
                noMeetingHint={null}
              />
            </div>
          ) : null
        }
      />
    </div>
  )
}
