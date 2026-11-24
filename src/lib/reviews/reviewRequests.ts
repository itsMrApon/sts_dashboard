import { prismaClient } from '@/lib/prismaClient'
import { isDeliverableEmail, sendPlainEmail } from '@/lib/email/sendEmail'
import { createReviewRequest, reviewLink } from '@/lib/reviews/reviews'

/**
 * The daily review-request job: for creators who turned on "Ask automatically", each buyer
 * whose order was paid `delayDays` ago (within the last 30 days) gets one review link by
 * email. One request per order, ever. Without SMTP or a buyer email, the link is still
 * created so the creator can copy it from Services → Reviews.
 */

const LOOKBACK_DAYS = 30

export type ReviewRequestSummary = { creators: number; created: number; emailed: number; errors: string[] }

export async function runReviewRequests(baseUrl: string, now = new Date()): Promise<ReviewRequestSummary> {
  const summary: ReviewRequestSummary = { creators: 0, created: 0, emailed: 0, errors: [] }
  const settings = await prismaClient.reviewSettings.findMany({ where: { autoRequest: true } })

  for (const setting of settings) {
    summary.creators += 1
    const paidBefore = new Date(now.getTime() - setting.delayDays * 24 * 60 * 60 * 1000)
    const paidAfter = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    const [orders, business, owner] = await Promise.all([
      prismaClient.order.findMany({
        where: {
          userId: setting.userId,
          status: 'PAID',
          paidAt: { lte: paidBefore, gte: paidAfter },
          contactId: { not: null },
        },
        select: { id: true, webinarId: true, contactId: true },
        take: 200,
      }),
      prismaClient.publishProfile.findFirst({ where: { userId: setting.userId }, select: { name: true } }),
      prismaClient.user.findUnique({ where: { id: setting.userId }, select: { email: true } }),
    ])
    if (orders.length === 0) continue
    const already = new Set(
      (await prismaClient.review.findMany({ where: { orderId: { in: orders.map((order) => order.id) } }, select: { orderId: true } }))
        .map((row) => row.orderId),
    )

    for (const order of orders) {
      if (already.has(order.id)) continue
      try {
        const contact = order.contactId
          ? await prismaClient.contact.findFirst({
              where: { id: order.contactId, userId: setting.userId },
              select: { name: true, email: true },
            })
          : null
        const request = await createReviewRequest({
          userId: setting.userId,
          webinarId: order.webinarId,
          orderId: order.id,
          contactId: order.contactId,
          customerName: contact?.name ?? null,
        })
        summary.created += 1
        if (!isDeliverableEmail(contact?.email)) continue
        const businessName = business?.name ?? 'us'
        const sent = await sendPlainEmail({
          userId: setting.userId,
          fromName: business?.name,
          to: contact.email,
          replyTo: owner?.email,
          subject: `How was it? A quick review for ${businessName}`,
          text: [
            contact.name ? `Hi ${contact.name.split(/\s+/)[0]},` : 'Hi,',
            '',
            `Thank you for choosing ${businessName}. Would you share a few words about your experience?`,
            'It takes under a minute:',
            reviewLink(baseUrl, request.token),
            '',
            'Thank you!',
          ].join('\n'),
        })
        if (sent) {
          await prismaClient.review.update({ where: { id: request.id }, data: { sentAt: new Date() } })
          summary.emailed += 1
        }
      } catch (error) {
        summary.errors.push(`${order.id}: ${error instanceof Error ? error.message : 'failed'}`)
      }
    }
  }
  return summary
}
