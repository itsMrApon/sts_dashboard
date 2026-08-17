import { Prisma } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import {
  isFathomOwnerIdentity,
  isSyntheticFathomEmail,
  normalizeFathomMeeting,
  resolveFathomLeadIdentity,
  type FathomMeeting,
} from '@/lib/fathom/client'
import { upsertLeadFromEmail } from '@/lib/leads/projectFormByEmail'
import { scoreMeetingAndSave } from '@/lib/leads/scoreSummaryVsAgent'

/**
 * Remove leads that are actually the SaaS creator / Fathom host (bad rows from
 * older identity bugs). Call after ingest so meetings already moved to guests.
 */
export async function purgeOwnerSelfLeads(options: {
  userId: string
  ownerEmails: string[]
  ownerNames?: string[]
}): Promise<number> {
  const emails = options.ownerEmails
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (emails.length === 0 && !(options.ownerNames || []).length) return 0

  const leads = await prismaClient.callIntelLead.findMany({
    where: { userId: options.userId },
    select: { id: true, email: true, name: true },
  })

  let removed = 0
  for (const lead of leads) {
    const isOwner = isFathomOwnerIdentity(
      { email: lead.email, name: lead.name },
      emails,
      options.ownerNames || [],
    )
    // Also catch synthetic host leads like itsmrapon@fathom.local
    const isSyntheticOwner =
      isSyntheticFathomEmail(lead.email) &&
      isFathomOwnerIdentity(
        { email: null, name: lead.name },
        emails,
        options.ownerNames || [],
      )

    if (!isOwner && !isSyntheticOwner) continue

    await prismaClient.callIntelLead.delete({ where: { id: lead.id } })
    removed++
  }
  return removed
}

/**
 * When we later learn a real guest email, fold any same-name @fathom.local
 * lead into the real one so Instant → Calendar upgrades don't fork leads.
 */
async function mergeSyntheticLeadByName(options: {
  userId: string
  realLeadId: string
  name: string
}) {
  const name = options.name.trim()
  if (!name) return
  const firstToken = name.split(/\s+/)[0]?.toLowerCase() || ''

  const synthetics = await prismaClient.callIntelLead.findMany({
    where: {
      userId: options.userId,
      id: { not: options.realLeadId },
      email: { endsWith: '@fathom.local' },
    },
    select: { id: true, name: true },
    take: 30,
  })

  for (const syn of synthetics) {
    const synName = syn.name.trim().toLowerCase()
    const synFirst = synName.split(/\s+/)[0] || ''
    const same =
      synName === name.toLowerCase() ||
      (firstToken.length >= 3 &&
        synFirst.length >= 3 &&
        (synFirst === firstToken ||
          synName.includes(firstToken) ||
          name.toLowerCase().includes(synFirst)))
    if (!same) continue

    await prismaClient.callIntelMeeting.updateMany({
      where: { leadId: syn.id },
      data: { leadId: options.realLeadId },
    })
    await prismaClient.callIntelBrief.updateMany({
      where: { leadId: syn.id },
      data: { leadId: options.realLeadId },
    })
    await prismaClient.callIntelLead.delete({ where: { id: syn.id } }).catch(() => {
      /* may race; ignore */
    })
  }
}

export async function ingestFathomMeetingForUser(options: {
  userId: string
  ownerEmail?: string | null
  meeting: FathomMeeting
  /** Cron may auto-score; manual Sync should leave scoring to the user. */
  autoScore?: boolean
  geminiApiKey?: string | null
}) {
  const normalized = normalizeFathomMeeting(options.meeting)
  const identity = resolveFathomLeadIdentity(
    options.meeting,
    options.ownerEmail ? [options.ownerEmail] : [],
  )

  let leadId: string | null = null
  if (identity) {
    const settings = await prismaClient.callIntelSettings.findUnique({
      where: { userId: options.userId },
      select: { defaultAgentId: true },
    })
    const lead = await upsertLeadFromEmail({
      userId: options.userId,
      email: identity.email,
      name: identity.name,
      lastAppointmentAt: normalized.recordedAt,
    })
    // Attach default agent for scoring when missing
    if (settings?.defaultAgentId && !lead.selectedAgentId) {
      await prismaClient.callIntelLead.update({
        where: { id: lead.id },
        data: { selectedAgentId: settings.defaultAgentId },
      })
    }
    leadId = lead.id

    if (!identity.emailIsSynthetic && !isSyntheticFathomEmail(identity.email)) {
      await mergeSyntheticLeadByName({
        userId: options.userId,
        realLeadId: lead.id,
        name: identity.name,
      })
    }
  }

  const meeting = await prismaClient.callIntelMeeting.upsert({
    where: { fathomRecordingId: normalized.fathomRecordingId },
    create: {
      userId: options.userId,
      leadId,
      fathomRecordingId: normalized.fathomRecordingId,
      summary: normalized.summary,
      actionItems: normalized.actionItems as Prisma.InputJsonValue,
      participants: normalized.participants as Prisma.InputJsonValue,
      recordedAt: normalized.recordedAt,
      duration: normalized.duration,
      fathomUrl: normalized.fathomUrl,
    },
    update: {
      leadId: leadId || undefined,
      summary: normalized.summary,
      actionItems: normalized.actionItems as Prisma.InputJsonValue,
      participants: normalized.participants as Prisma.InputJsonValue,
      recordedAt: normalized.recordedAt,
      duration: normalized.duration,
      fathomUrl: normalized.fathomUrl,
    },
    include: {
      lead: { select: { id: true, selectedAgentId: true } },
      scores: { select: { id: true }, take: 1 },
    },
  })

  if (
    options.autoScore === true &&
    meeting.summary &&
    meeting.lead?.selectedAgentId &&
    meeting.scores.length === 0
  ) {
    try {
      await scoreMeetingAndSave({
        meetingId: meeting.id,
        agentId: meeting.lead.selectedAgentId,
        apiKey: options.geminiApiKey,
      })
    } catch (err) {
      console.error('Auto score failed', err)
    }
  }

  return meeting
}
