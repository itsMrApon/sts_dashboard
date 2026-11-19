import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { onAuthenticateUser } from '@/actions/auth'
import { LeadPageHeaderControls } from './_components/LeadPageHeaderControls'
import { LeadViewport } from './_components/LeadViewport'
import { LeadDashboardLoader } from './_components/LeadDashboardLoader'
import { LeadDashboardSkeleton } from './_components/LeadDashboardSkeleton'
import { LeadUnavailableState } from './_components/LeadUnavailableState'
import { LeadSettingsLoader } from './_components/LeadSettingsLoader'

export default async function LeadCallIntelPage() {
  const auth = await onAuthenticateUser()
  if (auth.status === 500) {
    return <LeadUnavailableState />
  }
  if (!auth.user) redirect('/sign-in')

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Just the view toggle and settings: the calendar and list get the rest of the height. */}
      <div className="flex shrink-0 justify-end">
        <div className="sm:hidden">
          <LeadPageHeaderControls compact />
        </div>
        <div className="hidden sm:block">
          <LeadPageHeaderControls />
        </div>
      </div>

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

      {/* Lead settings panel (opened by the ⚙ buttons and "add key" prompts). */}
      <Suspense fallback={null}>
        <LeadSettingsLoader userId={auth.user.id} />
      </Suspense>
    </div>
  )
}
