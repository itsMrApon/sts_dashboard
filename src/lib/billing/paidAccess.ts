import 'server-only'
import { prismaClient } from '@/lib/prismaClient'
import { resolveUserProviderKey } from '@/lib/credentials/providerKeys'

/**
 * Creators can build and save drafts for free. Going live (turning a service on, publishing,
 * creating an offer) is free for creators who bring their own AI key (Gemini, saved in AI Agents
 * → Config); a platform package is the other way in. `User.subscription` is kept in sync by
 * syncPlatformAccess.
 */
export const PAID_ACCESS_ERROR =
  'To go live, add your own Gemini key in AI Agents → Config (free), or tap STS at the top to subscribe.'

/** Has a platform package (the paid plan). */
export async function userHasPaidAccess(userId: string): Promise<boolean> {
  const user = await prismaClient.user.findUnique({ where: { id: userId }, select: { subscription: true } })
  return !!user?.subscription
}

/** May go live: a paid plan, or the creator's own Gemini key (the free way). */
export async function userCanGoLive(userId: string): Promise<boolean> {
  if (await userHasPaidAccess(userId)) return true
  return Boolean(await resolveUserProviderKey(userId, 'google'))
}
