import { Suspense } from 'react'
import { LeadDashboardLoader } from '../_components/LeadDashboardLoader'
import { LeadDashboardSkeleton } from '../_components/LeadDashboardSkeleton'
import { LeadSectionPage } from '../_components/LeadSectionPage'

export default function LeadListPage() {
  return (
    <LeadSectionPage>
      {(user) => (
        <Suspense fallback={<LeadDashboardSkeleton />}>
          <LeadDashboardLoader user={user} view="list" />
        </Suspense>
      )}
    </LeadSectionPage>
  )
}
