import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { onAuthenticateUser } from '@/actions/auth'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'

/**
 * Every /social page works on the creator's one business, like /services. Cached per request,
 * so the page and its SocialShell share one lookup.
 */
export const loadSocialContext = cache(async () => {
  const auth = await onAuthenticateUser()
  if (!auth.user) redirect('/sign-in')
  const business = await getCreatorBusiness(auth.user.id)
  if (!business) redirect('/onboarding')
  return { user: auth.user, business }
})
