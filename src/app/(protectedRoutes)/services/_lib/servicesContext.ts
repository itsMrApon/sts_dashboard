import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { onAuthenticateUser } from '@/actions/auth'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'
import { getWebsiteConnection } from '@/lib/embed/websiteConnection'

/**
 * Every /services page works on the creator's one business — no room picker. Cached per request,
 * so the page and its ServicesShell share one lookup.
 */
export const loadServicesContext = cache(async () => {
  const auth = await onAuthenticateUser()
  if (!auth.user) redirect('/sign-in')
  const business = await getCreatorBusiness(auth.user.id)
  if (!business) redirect('/onboarding')
  const connection = await getWebsiteConnection(business.roomName)
  return { user: auth.user, business, connection }
})
