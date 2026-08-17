'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export type TenantChip = {
  id: string
  name: string
  publishProfileId: string | null
  businessName: string | null
  contextStatus?: string
}

type Props = {
  tenants: TenantChip[]
  activeTenantId: string | null
  basePath?: '/tenants/partners' | '/messages/publish'
}

export function TenantSwitcher({
  tenants,
  activeTenantId,
  basePath = '/tenants/partners',
}: Props) {
  if (tenants.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 items-center text-sm">
      <span className="text-muted-foreground shrink-0">Workspace:</span>
      {tenants.map((tenant) => {
        const active = tenant.id === activeTenantId
        return (
          <Link
            key={tenant.id}
            href={`${basePath}?tenantId=${tenant.id}`}
            className={cn(
              'inline-flex max-w-[240px] items-center gap-2 rounded-md border px-3 py-1.5 transition-colors',
              active ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-muted/80',
            )}
          >
            <span className="truncate font-medium">{tenant.name}</span>
            {tenant.businessName &&
            tenant.businessName.trim().toLowerCase() !== tenant.name.trim().toLowerCase() ? (
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                {tenant.businessName}
              </Badge>
            ) : null}
          </Link>
        )
      })}
    </div>
  )
}
