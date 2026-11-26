import { createHmac, timingSafeEqual } from 'node:crypto'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'
import { appendToConversation } from '@/lib/messages/conversationStore'
import { prismaClient } from '@/lib/prismaClient'
import { connectionByIgUserId } from '@/lib/instagram/connection'
import { replyToComment, sendDirectMessage, sendPrivateReply, InstagramApiError } from '@/lib/instagram/graph'

/**
 * Comment → DM: matches comments on the creator's posts against their keyword campaigns,
 * queues one private reply per comment, sends it (and the optional public reply), and turns
 * the commenter into a lead. Replies to the DM that contain an email or phone are added to
 * that lead.
 */

const MAX_ATTEMPTS = 4
/** Meta allows about 750 private replies per hour per account; stay under it. */
const HOURLY_CAP = 700

/** Meta signs webhook bodies with the app secret: "sha256=<hex>" in X-Hub-Signature-256. */
export function verifyMetaSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.INSTAGRAM_APP_SECRET
  if (!secret || !header?.startsWith('sha256=')) return false
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const given = header.slice(7)
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected))
}

/** Lower case only: Bangla and other scripts are compared exactly as typed. */
function normalize(text: string): string {
  return text.toLocaleLowerCase().replace(/\s+/g, ' ').trim()
}

export function commentMatches(text: string, keywords: string[], mode: string): boolean {
  const comment = normalize(text)
  return keywords.some((keyword) => {
    const word = normalize(keyword)
    if (!word) return false
    if (mode !== 'word') return comment.includes(word)
    // Whole word: the keyword is bounded by spaces, punctuation or the ends (works for Bangla).
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[\\s\\p{P}])${escaped}($|[\\s\\p{P}])`, 'u').test(comment)
  })
}

type CommentChange = {
  id?: string
  text?: string
  from?: { id?: string; username?: string }
  media?: { id?: string }
  parent_id?: string
}

/** One "comments" change from the webhook: queue a DM for each campaign it matches. */
export async function handleComment(igUserId: string, change: CommentChange): Promise<number> {
  const commentId = change.id
  const commenterId = change.from?.id
  const text = change.text?.trim()
  if (!commentId || !commenterId || !text) return 0
  // The account's own comments (including its public replies) never trigger anything.
  if (commenterId === igUserId) return 0
  const connection = await connectionByIgUserId(igUserId)
  if (!connection) return 0

  const campaigns = await prismaClient.instagramCampaign.findMany({
    where: { userId: connection.userId, active: true, OR: [{ mediaId: null }, { mediaId: change.media?.id ?? '' }] },
  })
  let queued = 0
  for (const campaign of campaigns) {
    if (!commentMatches(text, campaign.keywords, campaign.matchMode)) continue
    try {
      await prismaClient.instagramDmJob.create({
        data: {
          campaignId: campaign.id,
          userId: connection.userId,
          commentId,
          commenterId,
          commenterUsername: change.from?.username ?? null,
          commentText: text.slice(0, 2000),
        },
      })
      await prismaClient.instagramCampaign.update({ where: { id: campaign.id }, data: { matchedCount: { increment: 1 } } })
      queued += 1
    } catch {
      // Already queued (Meta retried the webhook): the unique key keeps it to one DM.
    }
  }
  return queued
}

function buildDm(campaign: { dmText: string; linkUrl: string | null; askContact: boolean }, username: string | null): string {
  const lines = [campaign.dmText.replace(/\{username\}/g, username ? `@${username}` : 'there')]
  if (campaign.linkUrl) lines.push(campaign.linkUrl)
  if (campaign.askContact) lines.push('Reply with your email or WhatsApp number and we will send you the details.')
  return lines.join('\n\n')
}

/** One lead per Instagram person per creator, keyed by a stand-in email the app never shows. */
async function upsertInstagramLead(job: { userId: string; commenterId: string; commenterUsername: string | null; commentText: string }, campaignId: string) {
  const email = `ig-${job.commenterId}@import.local`
  const note = `Instagram comment: "${job.commentText.slice(0, 300)}" (campaign ${campaignId.slice(0, 8)})`
  const lead = await prismaClient.callIntelLead.upsert({
    where: { userId_email: { userId: job.userId, email } },
    create: {
      userId: job.userId,
      email,
      name: job.commenterUsername ? `@${job.commenterUsername}` : 'Instagram follower',
      source: 'INSTAGRAM',
      importApp: 'INSTAGRAM',
      notes: note,
    },
    update: { notes: note },
    select: { id: true },
  })
  return lead.id
}

/** Sends due DMs, oldest first, with retries and the hourly cap. Safe to call often. */
export async function processInstagramQueue(limit = 50) {
  const due = await prismaClient.instagramDmJob.findMany({
    where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: 'asc' },
    take: limit,
    include: { campaign: true },
  })
  let sent = 0
  for (const job of due) {
    const connection = await prismaClient.instagramConnection.findUnique({ where: { userId: job.userId } })
    const tokenData = connection ? await connectionByIgUserId(connection.igUserId) : null
    if (!tokenData) {
      await prismaClient.instagramDmJob.update({ where: { id: job.id }, data: { status: 'SKIPPED', error: 'Instagram is not connected' } })
      continue
    }
    const sentLastHour = await prismaClient.instagramDmJob.count({
      where: { userId: job.userId, status: 'SENT', updatedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    })
    if (sentLastHour >= HOURLY_CAP) continue

    try {
      await sendPrivateReply(tokenData.token, job.commentId, buildDm(job.campaign, job.commenterUsername))
      if (job.campaign.publicReply?.trim()) {
        await replyToComment(tokenData.token, job.commentId, job.campaign.publicReply.replace(/\{username\}/g, job.commenterUsername ? `@${job.commenterUsername}` : '')).catch(
          (error) => console.warn('[instagram] public reply failed', error instanceof Error ? error.message : error),
        )
      }
      const leadId = await upsertInstagramLead(job, job.campaignId)
      await prismaClient.instagramDmJob.update({ where: { id: job.id }, data: { status: 'SENT', leadId, error: null } })
      await prismaClient.instagramCampaign.update({ where: { id: job.campaignId }, data: { sentCount: { increment: 1 } } })
      sent += 1
    } catch (error) {
      const attempts = job.attempts + 1
      const message = error instanceof Error ? error.message : 'send failed'
      // Permission, window and "not the thread owner" errors will not fix themselves.
      const permanent = error instanceof InstagramApiError && (error.status === 400 || error.status === 403)
      await prismaClient.instagramDmJob.update({
        where: { id: job.id },
        data: {
          attempts,
          error: message.slice(0, 500),
          status: permanent || attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
          nextAttemptAt: new Date(Date.now() + 2 ** attempts * 60 * 1000),
        },
      })
    }
  }
  return { due: due.length, sent }
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/
// Phone numbers in Latin or Bangla digits, 8 to 15 digits long.
const PHONE_RE = /\+?[\d০-৯][\d০-৯\s().-]{6,}[\d০-৯]/

function toLatinDigits(text: string): string {
  return text.replace(/[০-৯]/g, (digit) => String('০১২৩৪৫৬৭৮৯'.indexOf(digit)))
}

/** A DM from someone we wrote to: an email or phone in it goes on their lead, with a thank-you. */
export async function handleDirectMessage(igUserId: string, senderId: string, text: string) {
  if (senderId === igUserId) return
  const connection = await connectionByIgUserId(igUserId)
  if (!connection) return

  // Keep every DM so it shows in Messages (and can be answered there within 24 hours).
  const business = await getCreatorBusiness(connection.userId)
  if (business) {
    await appendToConversation({
      roomName: business.roomName,
      userId: connection.userId,
      externalId: `instagram:${senderId}`.slice(0, 128),
      messages: [{ role: 'user', content: text.slice(0, 4000), timestamp: new Date().toISOString() }],
    }).catch((error) => console.error('[instagram] could not store dm', error))
  }

  const job = await prismaClient.instagramDmJob.findFirst({
    where: { userId: connection.userId, commenterId: senderId, status: 'SENT', leadId: { not: null } },
    orderBy: { updatedAt: 'desc' },
    include: { campaign: { select: { id: true, askContact: true } } },
  })
  if (!job?.leadId || !job.campaign.askContact) return

  const email = text.match(EMAIL_RE)?.[0]?.toLowerCase() ?? null
  const phoneRaw = text.match(PHONE_RE)?.[0] ?? null
  const phone = phoneRaw ? toLatinDigits(phoneRaw).replace(/[^\d+]/g, '') : null
  if (!email && !(phone && phone.replace(/\D/g, '').length >= 8)) return

  const data: { phone?: string; email?: string } = {}
  if (phone) data.phone = phone.slice(0, 50)
  if (email) {
    const taken = await prismaClient.callIntelLead.findFirst({ where: { userId: connection.userId, email }, select: { id: true } })
    if (!taken) data.email = email
  }
  await prismaClient.callIntelLead.update({ where: { id: job.leadId }, data })
  await prismaClient.instagramCampaign.update({ where: { id: job.campaign.id }, data: { contactsCount: { increment: 1 } } })
  await sendDirectMessage(connection.token, senderId, 'Thank you! We got it and will be in touch soon.').catch(() => undefined)
}
