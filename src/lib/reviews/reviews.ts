import { randomBytes } from 'node:crypto'
import { prismaClient } from '@/lib/prismaClient'

/**
 * Customer reviews. A request is a private link (/review/<token>); the customer writes the
 * review there; the creator approves it before it shows on the website. Nothing is shown,
 * emailed or edited without the creator's say.
 */

export const REVIEW_LIMITS = { name: 100, text: 1500, maxRating: 5 } as const

export type ReviewStatus = 'REQUESTED' | 'SUBMITTED' | 'APPROVED' | 'HIDDEN'

export function newReviewToken(): string {
  return randomBytes(24).toString('base64url')
}

export function reviewLink(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/review/${token}`
}

export async function createReviewRequest(input: {
  userId: string
  webinarId?: string | null
  orderId?: string | null
  contactId?: string | null
  customerName?: string | null
}) {
  return prismaClient.review.create({
    data: {
      userId: input.userId,
      webinarId: input.webinarId ?? null,
      orderId: input.orderId ?? null,
      contactId: input.contactId ?? null,
      customerName: input.customerName?.trim().slice(0, REVIEW_LIMITS.name) || null,
      token: newReviewToken(),
    },
    select: { id: true, token: true },
  })
}

/** What the public review page needs: who it is for, and whether it is still open. */
export async function loadReviewRequest(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null
  const review = await prismaClient.review.findUnique({
    where: { token },
    select: {
      status: true,
      customerName: true,
      rating: true,
      text: true,
      userId: true,
      webinar: { select: { title: true } },
    },
  })
  if (!review) return null
  const business = await prismaClient.publishProfile.findFirst({
    where: { userId: review.userId },
    select: { name: true },
  })
  return {
    open: review.status === 'REQUESTED',
    customerName: review.customerName,
    businessName: business?.name ?? 'this business',
    projectTitle: review.webinar?.title ?? null,
  }
}

export type SubmitReviewResult = { ok: true } | { ok: false; error: string }

/** The customer's review. One submission per link; Bangla and other scripts kept as typed. */
export async function submitReview(input: { token: string; rating: number; text: string; name: string }): Promise<SubmitReviewResult> {
  const rating = Math.round(Number(input.rating))
  if (!Number.isFinite(rating) || rating < 1 || rating > REVIEW_LIMITS.maxRating) {
    return { ok: false, error: 'Choose 1 to 5 stars.' }
  }
  const text = input.text.trim().slice(0, REVIEW_LIMITS.text)
  const name = input.name.trim().slice(0, REVIEW_LIMITS.name)
  const updated = await prismaClient.review.updateMany({
    where: { token: input.token, status: 'REQUESTED' },
    data: {
      rating,
      text: text || null,
      ...(name ? { customerName: name } : {}),
      status: 'SUBMITTED',
      submittedAt: new Date(),
    },
  })
  return updated.count === 1 ? { ok: true } : { ok: false, error: 'This review link was already used or has expired.' }
}

export type ReviewView = {
  id: string
  customerName: string | null
  rating: number | null
  text: string | null
  status: ReviewStatus
  projectTitle: string | null
  token: string
  requestedAt: string
  submittedAt: string | null
  sentAt: string | null
}

export async function listReviews(userId: string): Promise<ReviewView[]> {
  const rows = await prismaClient.review.findMany({
    where: { userId },
    orderBy: [{ submittedAt: { sort: 'desc', nulls: 'last' } }, { requestedAt: 'desc' }],
    take: 300,
    include: { webinar: { select: { title: true } } },
  })
  return rows.map((row) => ({
    id: row.id,
    customerName: row.customerName,
    rating: row.rating,
    text: row.text,
    status: row.status as ReviewStatus,
    projectTitle: row.webinar?.title ?? null,
    token: row.token,
    requestedAt: row.requestedAt.toISOString(),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
  }))
}

/** Approved reviews for the website, newest first. Only text, stars and a first name. */
export async function loadApprovedReviews(userId: string, limit = 6) {
  const rows = await prismaClient.review.findMany({
    where: { userId, status: 'APPROVED', rating: { not: null } },
    orderBy: { approvedAt: 'desc' },
    take: limit,
    select: { customerName: true, rating: true, text: true, submittedAt: true },
  })
  return rows.map((row) => ({
    name: row.customerName?.split(/\s+/)[0] || 'A customer',
    rating: row.rating ?? 5,
    text: row.text ?? '',
    date: row.submittedAt?.toISOString() ?? null,
  }))
}

export async function loadReviewSettings(userId: string) {
  const row = await prismaClient.reviewSettings.findUnique({ where: { userId } })
  return { autoRequest: row?.autoRequest ?? false, delayDays: row?.delayDays ?? 3 }
}
