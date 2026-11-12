import 'server-only'
import { redirect } from 'next/navigation'
import { onAuthenticateUser } from '@/actions/auth'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'

/** Every /messages page works on the creator's one business — no room picker. */
export async function loadMessagesContext() {
  const auth = await onAuthenticateUser()
  if (!auth.user) redirect('/sign-in')
  const business = await getCreatorBusiness(auth.user.id)
  if (!business) redirect('/onboarding')
  return { user: auth.user, business }
}
