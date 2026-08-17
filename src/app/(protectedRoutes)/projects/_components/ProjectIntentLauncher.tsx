'use client'

import type Stripe from 'stripe'
import type { Assistant } from '@vapi-ai/server-sdk/api'
import type { LiveKitUiAgentConfig } from '@/lib/livekit/livekitTypes'
import CreateWebinarButton from '@/components/ReusableComponent/CreateWebinarButton'

type Props = {
  intent: 'product' | 'webinar'
  tenantId?: string
  stripeProducts: Stripe.Product[]
  assistants: Assistant[]
  livekitAgents: LiveKitUiAgentConfig[]
}

export default function ProjectIntentLauncher({
  intent,
  tenantId,
  stripeProducts,
  assistants,
  livekitAgents,
}: Props) {
  return (
    <CreateWebinarButton
      stripeProducts={stripeProducts}
      assistants={assistants}
      livekitAgents={livekitAgents}
      hideTrigger
      autoOpenIntent={intent}
      preferredTenantId={tenantId}
    />
  )
}
