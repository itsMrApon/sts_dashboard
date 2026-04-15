'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Building2, Send } from 'lucide-react'
import Link from 'next/link'
import { pushTenantContextToN8n } from '@/actions/tenants'
import type { Tenant, Business } from '@prisma/client'

type TenantWithBusiness = Tenant & { business: Business | null }

type Props = {
  tenant: TenantWithBusiness
}

export const TenantDetailClient = ({ tenant }: Props) => {
  const [isPending, startTransition] = useTransition()

  const profileHref = tenant.businessId
    ? `/tenants/business-profile?businessId=${tenant.businessId}`
    : '/tenants/business-profile'

  const handleN8n = () => {
    startTransition(async () => {
      await pushTenantContextToN8n(tenant.id)
    })
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={profileHref}>
          <Button variant="outline" size="sm">
            <Building2 className="w-4 h-4 mr-1" />
            Business profile
          </Button>
        </Link>
        <Button size="sm" variant="secondary" onClick={handleN8n} disabled={isPending}>
          {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
          Send context to n8n
        </Button>
      </div>

      <section className="rounded-xl border border-border p-5 space-y-3">
        <h2 className="text-sm font-semibold">Business information</h2>
        {tenant.business ? (
          <dl className="text-sm space-y-2">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{tenant.business.name}</dd>
            </div>
            {tenant.business.description && (
              <div>
                <dt className="text-muted-foreground">Description</dt>
                <dd>{tenant.business.description}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No business linked. Edit the tenant or assign a business.</p>
        )}
      </section>

      <section className="rounded-xl border border-border p-5 space-y-3">
        <h2 className="text-sm font-semibold">Tenant pitch (Messages + AI)</h2>
        <div className="rounded-lg bg-muted p-4 text-sm whitespace-pre-wrap">{tenant.pitchMessage}</div>
        {tenant.videoUrl && (
          <p className="text-sm text-muted-foreground break-all">
            <span className="font-medium text-foreground">Video: </span>
            {tenant.videoUrl}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-dashed border-border p-5 space-y-3 bg-muted/30">
        <h2 className="text-sm font-semibold">Connect n8n</h2>
        <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-2">
          <li>In n8n, add a Webhook node (POST) and copy the production URL.</li>
          <li>Set <code className="text-xs bg-muted px-1 rounded">N8N_TENANT_WEBHOOK_URL</code> (or legacy{' '}
            <code className="text-xs bg-muted px-1 rounded">N8N_CAMPAIGN_WEBHOOK_URL</code>) in your app env.</li>
          <li>Use <strong>Send context to n8n</strong> above to POST tenant + business JSON for your workflows.</li>
        </ol>
      </section>
    </div>
  )
}
