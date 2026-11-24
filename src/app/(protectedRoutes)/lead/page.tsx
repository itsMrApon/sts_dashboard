import { redirect } from 'next/navigation'
import { onAuthenticateUser } from '@/actions/auth'
import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import { LeadHub } from './_components/LeadHub'
import { LeadUnavailableState } from './_components/LeadUnavailableState'

/** /lead: the hub. Intel, Calendar, List, Video and Diagram each have their own page under /lead. */
export default async function LeadHubPage() {
  const auth = await onAuthenticateUser()
  if (auth.status === 500) {
    return <LeadUnavailableState />
  }
  if (!auth.user) redirect('/sign-in')

  return (
    <PageViewport scrollable>
      <LeadHub />
    </PageViewport>
  )
}
