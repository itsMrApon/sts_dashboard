import { getTenants } from '@/actions/tenants'
import { getPartnerConnectorsForWorkspace } from '@/actions/inboundConnectors'
import { onAuthenticateUser } from '@/actions/auth'
import { startPerf, timeAsync } from '@/lib/dev/perf'
import { redirect } from 'next/navigation'
import { TenantConsoleLazy } from '../_components/TenantConsoleLazy'

const page = async () => {
  const timer = startPerf('route.tenants.chat')
  const auth = await timeAsync('route.tenants.chat.onAuthenticateUser', () => onAuthenticateUser())
  if (!auth.user) {
    redirect('/sign-in')
  }

  const tenants = await timeAsync('route.tenants.chat.getTenants', () => getTenants(auth.user.id))
  const workspaceId = tenants[0]?.id ?? null
  const connectors = workspaceId
    ? await timeAsync('route.tenants.chat.getPartnerConnectors', () =>
        getPartnerConnectorsForWorkspace(workspaceId, auth.user.id),
      )
    : []
  const connectedPartners = connectors
    .filter((connector) => connector.enabled)
    .map((connector) => ({
      id: connector.id,
      kind: connector.kind,
      label: connector.label,
    }))

  const rendered = (
    <TenantConsoleLazy workspaceId={workspaceId} connectedPartners={connectedPartners} />
  )
  timer.end({ tenantCount: tenants.length, partnerCount: connectedPartners.length })
  return rendered
}

export default page
