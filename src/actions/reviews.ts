'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { onAuthenticateUser } from '@/actions/auth'
import { clientIp } from '@/lib/embed/clientIp'
import { checkRateLimit } from '@/lib/embed/rateLimit'
import { prismaClient } from '@/lib/prismaClient'
import { createReviewRequest, submitReview } from '@/lib/reviews/reviews'

type Result = { ok: true; message?: string; token?: string } | { ok: false; error: string }

/** The customer's review from /review/<token>. Public; limited per address. */
export async function submitCustomerReview(input: { token: string; rating: number; text: string; name: string }): Promise<Result> {
  const ip = clientIp(await headers())
  if (!(await checkRateLimit(`review:${ip}`, 10, 60 * 60 * 1000)).ok) {
    return { ok: false, error: 'Too many tries. Please try again later.' }
  }
  const result = await submitReview(input)
  return result.ok ? { ok: true } : result
}

async function currentUserId() {
  const auth = await onAuthenticateUser()
  return auth.user?.id ?? null
}

/** A review link for any customer, to send yourself (WhatsApp, email, in person). */
export async function createReviewLink(input: { customerName: string }): Promise<Result> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  const request = await createReviewRequest({ userId, customerName: input.customerName })
  revalidatePath('/services/reviews')
  return { ok: true, token: request.token }
}

export async function setReviewStatus(input: { id: string; status: 'APPROVED' | 'HIDDEN' | 'SUBMITTED' }): Promise<Result> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  const updated = await prismaClient.review.updateMany({
    where: { id: input.id, userId, status: { in: ['SUBMITTED', 'APPROVED', 'HIDDEN'] } },
    data: { status: input.status, approvedAt: input.status === 'APPROVED' ? new Date() : null },
  })
  if (updated.count === 0) return { ok: false, error: 'That review is not ready to show yet.' }
  revalidatePath('/services/reviews')
  return { ok: true }
}

export async function deleteReviewRequest(input: { id: string }): Promise<Result> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  await prismaClient.review.deleteMany({ where: { id: input.id, userId, status: 'REQUESTED' } })
  revalidatePath('/services/reviews')
  return { ok: true }
}

export async function saveReviewSettings(input: { autoRequest: boolean; delayDays: number }): Promise<Result> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  const delayDays = Math.min(30, Math.max(0, Math.round(Number(input.delayDays) || 0)))
  await prismaClient.reviewSettings.upsert({
    where: { userId },
    create: { userId, autoRequest: input.autoRequest, delayDays },
    update: { autoRequest: input.autoRequest, delayDays },
  })
  revalidatePath('/services/reviews')
  return { ok: true, message: input.autoRequest ? `Buyers are asked ${delayDays} days after paying.` : 'Automatic requests are off.' }
}
