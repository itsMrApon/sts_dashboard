import { getTenants } from '@/actions/tenants'
import { getPartnerConnectorsForWorkspace } from '@/actions/inboundConnectors'
import { onAuthenticateUser } from '@/actions/auth'
import { startPerf, timeAsync } from '@/lib/dev/perf'
import { redirect } from 'next/navigation'
import { PartnersIntro } from './_components/PartnersIntro'

const page = async () => {
  const timer = startPerf('route.tenants')
  const auth = await timeAsync('route.tenants.onAuthenticateUser', () => onAuthenticateUser())
  if (!auth.user) {
    redirect('/sign-in')
  }

  const tenants = await timeAsync('route.tenants.getTenants', () => getTenants(auth.user.id))
  const workspaceId = tenants[0]?.id ?? null
  const connectors = workspaceId
    ? await timeAsync('route.tenants.getPartnerConnectors', () =>
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
    <PartnersIntro workspaceId={workspaceId} connectedPartners={connectedPartners} />
  )
  timer.end({ tenantCount: tenants.length, partnerCount: connectedPartners.length })
  return rendered
}

export default page
