import { redirect } from 'next/navigation'
import { onAuthenticateUser } from '@/actions/auth'
import { getInboundConnectorsForTenant } from '@/actions/inboundConnectors'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'
import { PARTNER_PRESETS } from '@/lib/partners/partnerPresets'
import { PartnerIntegrationPage } from '../_components/PartnerIntegrationPage'

type PageProps = {
  searchParams: Promise<{ kind?: string }>
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

  const business = await getCreatorBusiness(auth.user.id)
  if (!business) redirect('/onboarding')

  const params = await searchParams
  const integrationKind = resolveKind(params.kind)
  if (!integrationKind) redirect('/integrations')

  const connectors = await getInboundConnectorsForTenant(business.workspaceId, auth.user.id)
  const connector = connectors.find((row) => row.kind === integrationKind) ?? null
  return (
    <PartnerIntegrationPage
      kind={integrationKind}
      workspaceId={business.workspaceId}
      workspaceName={business.name}
      publishProfileId={business.publishProfileId}
      connector={connector}
    />
  )
}
