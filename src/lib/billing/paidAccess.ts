import 'server-only'
import { prismaClient } from '@/lib/prismaClient'

/**
 * Creators can build and save drafts for free; going live (turning a service on, publishing,
 * creating an offer) needs a platform package. `User.subscription` is kept in sync by
 * syncPlatformAccess, so this is a single indexed read.
 */
export const PAID_ACCESS_ERROR = 'Choose a package in Settings → Payment Integration to go live.'

export async function userHasPaidAccess(userId: string): Promise<boolean> {
  const user = await prismaClient.user.findUnique({ where: { id: userId }, select: { subscription: true } })
  return !!user?.subscription
}
