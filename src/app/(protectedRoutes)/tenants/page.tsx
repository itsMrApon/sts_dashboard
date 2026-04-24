import PageHeader from '@/components/ReusableComponent/PageHeader'
import { Megaphone, Sparkles, Users } from 'lucide-react'
import { getTenants } from '@/actions/tenants'
import { getBusinessOptions } from '@/actions/business'
import { onAuthenticateUser } from '@/actions/auth'
import { TenantCard } from './_components/TenantCard'
import { TenantActions } from './_components/TenantActions'
import Link from 'next/link'
import { startPerf, timeAsync } from '@/lib/dev/perf'
import { redirect } from 'next/navigation'

const page = async () => {
  const timer = startPerf('route.tenants')
  const auth = await timeAsync('route.tenants.onAuthenticateUser', () => onAuthenticateUser())
  if (!auth.user) {
    redirect('/sign-in')
  }

  const [tenants, businessOptions] = await Promise.all([
    timeAsync('route.tenants.getTenants', () => getTenants(auth.user.id)),
    timeAsync('route.tenants.getBusinessOptions', () => getBusinessOptions(auth.user.id)),
  ])

  const rendered = (
    <div className="w-full flex flex-col gap-8">
      <PageHeader
        leftIcon={<Users className="w-3 h-3" />}
        mainIcon={<Megaphone className="w-12 h-12" />}
        rightIcon={<Sparkles className="w-4 h-4" />}
        heading="Tenants"
        placeholder="Manage tenants…"
      >
        <div className="flex items-center gap-2">
          <Link
            href="/tenants/business-profile"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            Business profile
          </Link>
          <TenantActions businesses={businessOptions} />
        </div>
      </PageHeader>

      {businessOptions.length === 0 && (
        <p className="text-sm text-amber-600 dark:text-amber-500">
          Create a business first (e.g. from your dashboard) before adding tenants.
        </p>
      )}

      {tenants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 border border-dashed border-border rounded-xl">
          <p className="text-lg font-semibold text-primary">No tenants yet.</p>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            A tenant holds your pitch context for Messages and optional n8n. Link it to a business and connect
            outreach in Business profile.
          </p>
          <TenantActions businesses={businessOptions} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tenants.map((tenant: (typeof tenants)[number]) => (
            <TenantCard key={tenant.id} tenant={tenant} />
          ))}
        </div>
      )}
    </div>
  )
  timer.end({ tenantCount: tenants.length, businessCount: businessOptions.length })
  return rendered
}

export default page
