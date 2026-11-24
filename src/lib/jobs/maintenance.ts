import { prismaClient } from '@/lib/prismaClient'
import { isDeliverableEmail, sendPlainEmail } from '@/lib/email/sendEmail'
import { linkedTelegram } from '@/lib/telegram/telegramAlerts'
import { sendTelegramMessage } from '@/lib/telegram/telegramApi'

/** Small scheduled jobs run by trigger.dev (src/trigger/maintenance.ts). */

const DAY_MS = 24 * 60 * 60 * 1000

/** Keeps the database small: handled webhook deliveries and finished rate-limit windows. */
export async function cleanupOldRows(now = new Date()) {
  const [deliveries, counters] = await Promise.all([
    prismaClient.webhookDelivery.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 14 * DAY_MS) } } }),
    prismaClient.rateLimitCounter.deleteMany({ where: { resetAt: { lt: new Date(now.getTime() - DAY_MS) } } }),
  ])
  return { deliveries: deliveries.count, rateLimitCounters: counters.count }
}

/** Payment requests past their expiry date can no longer be paid. */
export async function expirePaymentRequests(now = new Date()) {
  const expired = await prismaClient.paymentRequest.updateMany({
    where: { status: 'OPEN', expiresAt: { lt: now } },
    data: { status: 'EXPIRED' },
  })
  return { expired: expired.count }
}

/** Sends a reminder once per attendee, webinar and kind (recorded like a webhook delivery). */
async function claimOnce(key: string): Promise<boolean> {
  try {
    await prismaClient.webhookDelivery.create({ data: { key, source: 'reminder' } })
    return true
  } catch {
    return false
  }
}

/**
 * Webinar reminders by email: about a day before and about an hour before, to everyone who
 * saved a seat. Runs every 15 minutes; each reminder goes out once.
 */
export async function sendWebinarReminders(baseUrl: string, now = new Date()) {
  const windows = [
    { kind: '24h', from: now.getTime() + 23 * 60 * 60 * 1000, to: now.getTime() + 25 * 60 * 60 * 1000, label: 'tomorrow' },
    { kind: '1h', from: now.getTime() + 45 * 60 * 1000, to: now.getTime() + 75 * 60 * 1000, label: 'in about an hour' },
  ] as const
  let sent = 0
  for (const window of windows) {
    const webinars = await prismaClient.webinar.findMany({
      where: {
        deletedAt: null,
        slug: { not: null },
        webinarStatus: 'SCHEDULED',
        startTime: { gte: new Date(window.from), lte: new Date(window.to) },
      },
      select: { id: true, title: true, slug: true, startTime: true, presenterId: true, presenter: { select: { email: true, name: true } } },
    })
    for (const webinar of webinars) {
      const attendances = await prismaClient.attendance.findMany({
        where: { webinarId: webinar.id },
        select: { user: { select: { id: true, email: true, name: true } } },
        take: 2000,
      })
      for (const { user: attendee } of attendances) {
        if (!isDeliverableEmail(attendee.email)) continue
        if (!(await claimOnce(`reminder:${window.kind}:${webinar.id}:${attendee.id}`))) continue
        const ok = await sendPlainEmail({
          userId: webinar.presenterId,
          fromName: webinar.presenter.name,
          to: attendee.email,
          replyTo: webinar.presenter.email,
          subject: `Reminder: ${webinar.title} starts ${window.label}`,
          text: [
            attendee.name ? `Hi ${attendee.name.split(/\s+/)[0]},` : 'Hi,',
            '',
            `"${webinar.title}" starts ${window.label} (${webinar.startTime.toUTCString()}).`,
            `Join here: ${baseUrl.replace(/\/+$/, '')}/live/${webinar.slug}`,
          ].join('\n'),
        }).catch(() => false)
        if (ok) sent += 1
      }
    }
  }
  return { sent }
}

/**
 * Each morning, a short summary on the creator's own Telegram: new leads, today's briefs,
 * unanswered questions and new reviews. Only creators who linked Telegram get it.
 */
export async function sendMorningSummaries(baseUrl: string, now = new Date()) {
  const connections = await prismaClient.telegramConnection.findMany({
    where: { enabled: true, chatId: { not: null } },
    select: { userId: true },
    distinct: ['userId'],
  })
  const since = new Date(now.getTime() - DAY_MS)
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  let sent = 0
  for (const { userId } of connections) {
    const telegram = await linkedTelegram(userId)
    if (!telegram) continue
    const [leads, briefs, questions, reviews] = await Promise.all([
      prismaClient.callIntelLead.count({ where: { userId, createdAt: { gte: since } } }),
      prismaClient.callIntelBrief.count({ where: { lead: { userId }, forDate: today } }),
      prismaClient.questionGroup.count({ where: { userId, status: 'OPEN', askedCount: { gt: 0 } } }),
      prismaClient.review.count({ where: { userId, status: 'SUBMITTED' } }),
    ])
    if (leads + briefs + questions + reviews === 0) continue
    const lines = [
      '☀️ Good morning. Here is your day:',
      leads ? `• ${leads} new ${leads === 1 ? 'lead' : 'leads'} since yesterday` : null,
      briefs ? `• ${briefs} ${briefs === 1 ? 'call' : 'calls'} today, briefs ready` : null,
      questions ? `• ${questions} customer ${questions === 1 ? 'question' : 'questions'} not answered yet` : null,
      reviews ? `• ${reviews} new ${reviews === 1 ? 'review' : 'reviews'} to check` : null,
    ].filter(Boolean)
    const result = await sendTelegramMessage(telegram.token, telegram.chatId, lines.join('\n'), {
      buttonUrl: { label: 'Open sts-ai', url: `${baseUrl.replace(/\/+$/, '')}/home` },
    }).catch(() => null)
    if (result?.ok) sent += 1
  }
  return { sent }
}
