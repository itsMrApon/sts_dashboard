import { redirect } from 'next/navigation'
import { onAuthenticateUser } from '@/actions/auth'
import { getPartnerConnectorsForWorkspace } from '@/actions/inboundConnectors'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'
import { startPerf, timeAsync } from '@/lib/dev/perf'
import { TenantConsoleLazy } from '../_components/TenantConsoleLazy'

const page = async () => {
  const timer = startPerf('route.integrations.chat')
  const auth = await timeAsync('route.integrations.chat.onAuthenticateUser', () => onAuthenticateUser())
  if (!auth.user) redirect('/sign-in')

  const business = await getCreatorBusiness(auth.user.id)
  if (!business) redirect('/onboarding')

  const connectors = await timeAsync('route.integrations.chat.getPartnerConnectors', () =>
    getPartnerConnectorsForWorkspace(business.workspaceId, auth.user.id),
  )
  const connectedPartners = connectors
    .filter((connector) => connector.enabled)
    .map((connector) => ({ id: connector.id, kind: connector.kind, label: connector.label }))

  timer.end({ partnerCount: connectedPartners.length })
  return <TenantConsoleLazy workspaceId={business.workspaceId} connectedPartners={connectedPartners} />
}

export default page
