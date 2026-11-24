import Link from 'next/link'
import { FileUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import IntegrationsSection, { IntegrationCard, IntegrationGroupHeading } from '@/components/ui/integrations-component'
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
  /** The creator's Telegram bot is set up and linked to a chat. */
  telegramLinked?: boolean
  /** The creator's Twilio number is answered by their Voice AI. */
  phoneNumber?: string | null
  /** Lead sources (they used to live in the Lead settings panel). */
  leadSources?: { fathomOk: boolean; googleOk: boolean; gcalLinked: boolean; serperOk: boolean }
  /** Platform owners only: the trigger.dev project that runs everyone's background jobs. */
  triggerDev?: { connected: boolean } | null
}

function introKind(kind: string): string {
  const normalized = normalizePartnerKind(kind)
  return normalized === 'custom' || normalized.startsWith('custom:') ? 'custom' : normalized
}

export function PartnersIntro({
  workspaceId,
  connectedPartners = [],
  telegramLinked = false,
  phoneNumber = null,
  leadSources,
  triggerDev = null,
}: Props) {
  const connectedKinds = new Set(connectedPartners.map((partner) => introKind(partner.kind)))
  const partnersHref = (kind: string) => {
    const params = new URLSearchParams({ kind })
    if (workspaceId) params.set('tenantId', workspaceId)
    return `/integrations/partners?${params.toString()}`
  }

  const headerAction = !workspaceId ? (
    <p className="text-muted-foreground text-sm">
      Partners attach to your Messages room.{' '}
      <Link href="/services" className="font-medium text-primary underline">
        Create a room
      </Link>{' '}
      first, then come back to connect.
    </p>
  ) : (
    <Button asChild variant="outline" size="sm">
      <Link href="/integrations/chat">Ask the partner assistant</Link>
    </Button>
  )

  return (
    <PageViewport scrollable>
      <IntegrationsSection
        heading="Connect with your favorite partners"
        description="Your channels, your accounts, and the apps you already run. Each group says what it needs to work."
        action={headerAction}
      >
        <IntegrationGroupHeading
          title="Channels"
          description="Where customers reach you. These send to sts-ai on their own."
          note="No tunnel needed"
        />
        <IntegrationCard
          title="Telegram"
          description="Get buyer chats on your phone or in a team group, and reply from Telegram"
          link="/integrations/telegram"
          cta={telegramLinked ? 'Manage' : 'Set up'}
          badge={telegramLinked ? 'Connected' : undefined}
        >
          <PartnerLogo kind="telegram" />
        </IntegrationCard>
        <IntegrationCard
          title="Phone"
          description={
            phoneNumber
              ? `Your Voice AI answers ${phoneNumber}`
              : 'Your Voice AI answers calls to your own Twilio number'
          }
          link="/integrations/phone"
          cta={phoneNumber ? 'Manage' : 'Set up'}
          badge={phoneNumber ? 'Connected' : undefined}
        >
          <PartnerLogo kind="twilio" />
        </IntegrationCard>

        <IntegrationGroupHeading
          title="Lead sources"
          description="Your own accounts that bring in calls, meetings and businesses."
          note="Your keys"
        />
        <IntegrationCard
          title="Fathom"
          description="Recorded calls and their summaries come in as leads"
          link="/integrations/fathom"
          cta={leadSources?.fathomOk ? 'Manage' : 'Set up'}
          badge={leadSources?.fathomOk ? 'Connected' : undefined}
        >
          <PartnerLogo kind="fathom" />
        </IntegrationCard>
        <IntegrationCard
          title="Google OAuth"
          description="Link Google Calendar and schedule Meet calls with leads"
          link="/integrations/google"
          cta={leadSources?.googleOk ? 'Manage' : 'Set up'}
          badge={leadSources?.gcalLinked ? 'Calendar linked' : leadSources?.googleOk ? 'Saved' : undefined}
        >
          <PartnerLogo kind="google" />
        </IntegrationCard>
        <IntegrationCard
          title="Serper"
          description="Find businesses on Google Maps for your outreach"
          link="/integrations/serper"
          cta={leadSources?.serperOk ? 'Manage' : 'Set up'}
          badge={leadSources?.serperOk ? 'Connected' : undefined}
        >
          <PartnerLogo kind="serper" />
        </IntegrationCard>

        <IntegrationGroupHeading
          title="Import and export"
          description="Bring leads in from a file or another app, or take them out as a spreadsheet."
          note="No tunnel needed"
        />
        <IntegrationCard
          title="Lead imports"
          description="CSV, Sellbird and n8n webhooks bring leads in. Export is on the lead list"
          link="/lead/intel"
          cta="Open"
        >
          <FileUp className="text-violet-500" aria-hidden />
        </IntegrationCard>

        <IntegrationGroupHeading
          title="Partner apps"
          description="sts-ai calls these apps while it works. One running on your own computer needs a public address, such as a Cloudflare Tunnel."
          note="Live connection"
        />
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

        {triggerDev ? (
          <>
            <IntegrationGroupHeading
              title="Platform"
              description="Settings for all of sts-ai. Only platform owners see this group."
            />
            <IntegrationCard
              title="trigger.dev"
              description="Runs the daily lead jobs for every creator"
              link="/integrations/trigger"
              cta={triggerDev.connected ? 'Manage' : 'Set up'}
              badge={triggerDev.connected ? 'Connected' : undefined}
            >
              <PartnerLogo kind="trigger" />
            </IntegrationCard>
          </>
        ) : null}
      </IntegrationsSection>
    </PageViewport>
  )
}
