'use client'

import Link from 'next/link'
import { ChevronLeft, Settings } from 'lucide-react'
import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TenantChatViewLazy } from './TenantChatViewLazy'

export type TenantConsoleTenant = {
  id: string
  name: string
  publishProfileId: string | null
  businessName: string | null
}

export type ConnectedPartnerOption = {
  id: string
  kind: string
  label: string
}

type Props = {
  workspaceId: string | null
  connectedPartners?: ConnectedPartnerOption[]
}

export function TenantConsole({ workspaceId, connectedPartners = [] }: Props) {
  if (!workspaceId) {
    return (
      <PageViewport>
        <div className="flex h-full min-h-0 w-full flex-col gap-8 overflow-y-auto">
          <Button variant="outline" size="sm" className="w-fit gap-2" asChild>
            <Link href="/tenants">
              <ChevronLeft className="h-4 w-4" />
              All partners
            </Link>
          </Button>
          <Card className="py-0">
            <CardContent className="flex flex-col items-center gap-4 px-6 py-10 text-center text-sm text-muted-foreground">
              <p>
                Partners attach to your Messages room. Create a room first, then come back to
                connect Medusa, ERPNext, or n8n.
              </p>
              <Button asChild>
                <Link href="/messages">Go to Messages</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageViewport>
    )
  }

  return (
    <PageViewport>
      <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
        <div className="absolute top-0 right-0 left-0 z-20 flex items-center justify-between gap-2 p-1">
          <Button variant="ghost" size="sm" className="gap-2" asChild>
            <Link href="/tenants">
              <ChevronLeft className="h-4 w-4" />
              All partners
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/tenants" aria-label="Partner settings">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <TenantChatViewLazy tenantId={workspaceId} connectedPartners={connectedPartners} />
      </div>
    </PageViewport>
  )
}
