'use client'

import dynamic from 'next/dynamic'

type ConnectedPartnerOption = {
  id: string
  kind: string
  label: string
}

type Props = {
  tenantId: string
  connectedPartners?: ConnectedPartnerOption[]
}

const TenantChatView = dynamic(
  () => import('./TenantChatView').then((mod) => mod.TenantChatView),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground flex min-h-[28rem] flex-1 items-center justify-center text-sm">
        Loading chat…
      </div>
    ),
  },
)

export function TenantChatViewLazy({ tenantId, connectedPartners }: Props) {
  return <TenantChatView tenantId={tenantId} connectedPartners={connectedPartners} />
}
