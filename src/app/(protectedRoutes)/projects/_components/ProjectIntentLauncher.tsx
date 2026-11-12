'use client'

import type Stripe from 'stripe'
import type { LiveKitUiAgentConfig } from '@/lib/livekit/livekitTypes'
import CreateWebinarButton from '@/components/ReusableComponent/CreateWebinarButton'

type Props = {
  intent: 'product' | 'webinar'
  tenantId?: string
  stripeProducts: Stripe.Product[]
  livekitAgents: LiveKitUiAgentConfig[]
}

export default function ProjectIntentLauncher({
  intent,
  tenantId,
  stripeProducts,
  livekitAgents,
}: Props) {
  return (
    <CreateWebinarButton
      stripeProducts={stripeProducts}
      livekitAgents={livekitAgents}
      hideTrigger
      autoOpenIntent={intent}
      preferredTenantId={tenantId}
    />
  )
}
