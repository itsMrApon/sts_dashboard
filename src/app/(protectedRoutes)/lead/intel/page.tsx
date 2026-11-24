import { Suspense } from 'react'
import { getLeadIntelData } from '@/lib/leads/import/leadIntelData'
import { LeadDashboardSkeleton } from '../_components/LeadDashboardSkeleton'
import { LeadSectionPage } from '../_components/LeadSectionPage'
import { LeadUnavailableState } from '../_components/LeadUnavailableState'
import { LeadIntel } from '../_components/intel/LeadIntel'

async function LeadIntelLoader({ userId }: { userId: string }) {
  const data = await getLeadIntelData(userId)
  if ('unavailable' in data) return <LeadUnavailableState />
  return <LeadIntel data={data} />
}

/** /lead/intel: where each lead field comes from, and every app that brings leads in. */
export default function LeadIntelPage() {
  return (
    <LeadSectionPage>
      {(user) => (
        <Suspense fallback={<LeadDashboardSkeleton />}>
          <LeadIntelLoader userId={user.id} />
        </Suspense>
      )}
    </LeadSectionPage>
  )
}
