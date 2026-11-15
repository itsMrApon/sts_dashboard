import { redirect } from 'next/navigation'
import { onAuthenticateUser } from '@/actions/auth'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'
import { OnboardingForm } from './_components/OnboardingForm'

export default async function OnboardingPage() {
  const auth = await onAuthenticateUser()
  if (!auth.user) redirect('/sign-in')
  if (await getCreatorBusiness(auth.user.id)) redirect('/services')

  return <OnboardingForm defaultName="" />
}
