import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/ReusableComponent/PageHeader'
import { Brain, CalendarDays, PhoneCall } from 'lucide-react'
import { onAuthenticateUser } from '@/actions/auth'
import { LeadPageHeaderControls } from './_components/LeadPageHeaderControls'
import { LeadViewport } from './_components/LeadViewport'
import { LeadDashboardLoader } from './_components/LeadDashboardLoader'
import { LeadDashboardSkeleton } from './_components/LeadDashboardSkeleton'
import { LeadUnavailableState } from './_components/LeadUnavailableState'

export default async function LeadCallIntelPage() {
  const auth = await onAuthenticateUser()
  if (auth.status === 500) {
    return <LeadUnavailableState />
  }
  if (!auth.user) redirect('/sign-in')

  return (
    <div className="flex w-full flex-col gap-8">
      <PageHeader
        leftIcon={<CalendarDays className="h-3 w-3" />}
        mainIcon={<PhoneCall className="h-12 w-12" />}
        rightIcon={<Brain className="h-4 w-4" />}
        heading="The home to all your Leads"
        placeholder="Search option..."
      >
        <LeadPageHeaderControls />
      </PageHeader>

      <LeadViewport>
        <Suspense fallback={<LeadDashboardSkeleton />}>
          <LeadDashboardLoader
            user={{
              id: auth.user.id,
              email: auth.user.email || '',
              name: auth.user.name,
            }}
          />
        </Suspense>
      </LeadViewport>
    </div>
  )
}
