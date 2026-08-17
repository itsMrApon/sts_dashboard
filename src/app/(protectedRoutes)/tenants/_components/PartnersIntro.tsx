import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import IntegrationsSection, { IntegrationCard } from '@/components/ui/integrations-component'
import { PARTNER_PRESETS } from '@/lib/partners/partnerPresets'
import { normalizePartnerKind } from '@/lib/tenants/tenantServices'
import { PartnerLogo } from './PartnerLogos'
import { PartnerPipelineTools } from './PartnerPipelineTools'

export type ConnectedPartnerOption = {
  id: string
  kind: string
  label: string
}

type Props = {
  workspaceId: string | null
  connectedPartners?: ConnectedPartnerOption[]
}

function introKind(kind: string): string {
  const normalized = normalizePartnerKind(kind)
  return normalized === 'custom' || normalized.startsWith('custom:') ? 'custom' : normalized
}

export function PartnersIntro({ workspaceId, connectedPartners = [] }: Props) {
  const connectedKinds = new Set(connectedPartners.map((partner) => introKind(partner.kind)))
  const partnersHref = (kind: string) => {
    const params = new URLSearchParams({ kind })
    if (workspaceId) params.set('tenantId', workspaceId)
    return `/tenants/partners?${params.toString()}`
  }

  const headerAction = !workspaceId ? (
    <p className="text-muted-foreground text-sm">
      Partners attach to your Messages room.{' '}
      <Link href="/messages" className="font-medium text-primary underline">
        Create a room
      </Link>{' '}
      first, then come back to connect.
    </p>
  ) : (
    <Button asChild variant="outline" size="sm">
      <Link href="/tenants/chat">Open partner assistant</Link>
    </Button>
  )

  return (
    <PageViewport scrollable>
      <IntegrationsSection
        heading="Connect with your favorite partners"
        description="Introduce Medusa, ERPNext, n8n, and more so your workspace can chat, automate, and act across tools."
        action={headerAction}
      >
        {PARTNER_PRESETS.map((preset) => {
          const connected = connectedKinds.has(preset.kind)
          return (
            <IntegrationCard
              key={preset.kind}
              title={preset.label}
              description={preset.description}
              link={partnersHref(preset.kind)}
              cta={connected ? 'Manage' : 'Learn More'}
              badge={connected ? 'Connected' : undefined}
              aside={<PartnerPipelineTools kind={preset.kind} />}
            >
              <PartnerLogo kind={preset.kind} />
            </IntegrationCard>
          )
        })}
      </IntegrationsSection>
    </PageViewport>
  )
}
