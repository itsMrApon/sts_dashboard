import { Suspense } from 'react'
import { ConnectAgentButton } from '@/components/agent/ConnectAgentButton'
import { getLeadIntelData } from '@/lib/leads/import/leadIntelData'
import { LeadDashboardSkeleton } from './_components/LeadDashboardSkeleton'
import { LeadSectionPage } from './_components/LeadSectionPage'
import { LeadUnavailableState } from './_components/LeadUnavailableState'
import { LeadIntel } from './_components/intel/LeadIntel'

async function LeadIntelLoader({ userId }: { userId: string }) {
  const data = await getLeadIntelData(userId)
  if ('unavailable' in data) return <LeadUnavailableState />
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 justify-center">
        <ConnectAgentButton />
      </div>
      <div className="min-h-0 flex-1">
        <LeadIntel data={data} />
      </div>
    </div>
  )
}

/**
 * /lead is Intel: a tray of folders. Approval and Calendar sit at the front, then every app that
 * brings leads in, with the Connect agent button centred over it. (/lead/intel redirects here.)
 */
export default function LeadPage() {
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
