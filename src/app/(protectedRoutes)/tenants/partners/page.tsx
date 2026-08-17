import { redirect } from 'next/navigation'
import { onAuthenticateUser } from '@/actions/auth'
import { getInboundConnectorsForTenant } from '@/actions/inboundConnectors'
import { getTenants, getWorkspaceMeta } from '@/actions/tenants'
import { PARTNER_PRESETS } from '@/lib/partners/partnerPresets'
import { PartnerIntegrationPage } from '../_components/PartnerIntegrationPage'

type PageProps = {
  searchParams: Promise<{ tenantId?: string; workspaceId?: string; kind?: string }>
}

function resolveKind(kind?: string) {
  if (!kind) return null
  const normalized = kind.trim().toLowerCase()
  const aliases: Record<string, string> = {
    ecommerce: 'medusa',
    ecom: 'medusa',
    madusa: 'medusa',
    saleor: 'medusa',
    automate: 'n8n',
    workflow: 'n8n',
    erp: 'erpnext',
    inbox: 'chatwoot',
    crawl: 'firecrawl',
    mcp: 'custom',
  }
  const mapped = aliases[normalized] ?? normalized
  return PARTNER_PRESETS.some((preset) => preset.kind === mapped) ? mapped : null
}

export default async function PartnersPage({ searchParams }: PageProps) {
  const auth = await onAuthenticateUser()
  if (!auth.user) redirect('/sign-in')

  const params = await searchParams
  const integrationKind = resolveKind(params.kind)
  if (!integrationKind) {
    redirect('/tenants')
  }

  const queryWorkspaceId = params.workspaceId || params.tenantId

  if (!queryWorkspaceId) {
    const allTenants = await getTenants(auth.user.id)
    if (allTenants[0]) {
      const qs = new URLSearchParams({
        tenantId: allTenants[0].id,
        kind: integrationKind,
      })
      redirect(`/tenants/partners?${qs.toString()}`)
    }
    return (
      <PartnerIntegrationPage
        kind={integrationKind}
        workspaceId={null}
        workspaceName={null}
        publishProfileId={null}
        connector={null}
      />
    )
  }

  const [workspace, connectors] = await Promise.all([
    getWorkspaceMeta(queryWorkspaceId, auth.user.id),
    getInboundConnectorsForTenant(queryWorkspaceId, auth.user.id),
  ])

  if (!workspace) {
    const allTenants = await getTenants(auth.user.id)
    const fallbackId = allTenants[0]?.id
    if (fallbackId) {
      const qs = new URLSearchParams({
        tenantId: fallbackId,
        kind: integrationKind,
      })
      redirect(`/tenants/partners?${qs.toString()}`)
    }
    return (
      <PartnerIntegrationPage
        kind={integrationKind}
        workspaceId={null}
        workspaceName={null}
        publishProfileId={null}
        connector={null}
      />
    )
  }

  const connector = connectors.find((row) => row.kind === integrationKind) ?? null
  return (
    <PartnerIntegrationPage
      kind={integrationKind}
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      publishProfileId={workspace.publishProfileId}
      connector={connector}
    />
  )
}
