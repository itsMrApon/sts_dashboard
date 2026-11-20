import { redirect } from 'next/navigation'
import { onAuthenticateUser } from '@/actions/auth'
import { getPhoneSetup } from '@/actions/phone'
import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import { PhoneSetup } from './_components/PhoneSetup'

export default async function PhonePage() {
  const auth = await onAuthenticateUser()
  if (!auth.user) redirect('/sign-in')
  const status = await getPhoneSetup()
  return (
    <PageViewport scrollable>
      <PhoneSetup initialStatus={status} />
    </PageViewport>
  )
}
