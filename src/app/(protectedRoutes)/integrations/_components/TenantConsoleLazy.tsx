'use client'

import dynamic from 'next/dynamic'

const TenantConsole = dynamic(
  () => import('./TenantConsole').then((mod) => mod.TenantConsole),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground flex min-h-[50vh] items-center justify-center text-sm">
        Loading partners…
      </div>
    ),
  },
)

type ConnectedPartnerOption = {
  id: string
  kind: string
  label: string
}

type Props = {
  workspaceId: string | null
  connectedPartners?: ConnectedPartnerOption[]
}

export function TenantConsoleLazy({ workspaceId, connectedPartners }: Props) {
  return <TenantConsole workspaceId={workspaceId} connectedPartners={connectedPartners} />
}
