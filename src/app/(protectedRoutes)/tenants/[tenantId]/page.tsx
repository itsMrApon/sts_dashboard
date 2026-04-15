import { notFound } from 'next/navigation'
import PageHeader from '@/components/ReusableComponent/PageHeader'
import { ChevronLeft, Megaphone, Sparkles } from 'lucide-react'
import { getTenantById } from '@/actions/tenants'
import { TenantDetailClient } from './_components/TenantDetailClient'
import Link from 'next/link'

type Props = {
  params: Promise<{ tenantId: string }>
}

const page = async ({ params }: Props) => {
  const { tenantId } = await params
  const tenant = await getTenantById(tenantId)
  if (!tenant) notFound()

  return (
    <div className="w-full flex flex-col gap-8">
      <PageHeader
        leftIcon={
          <Link href="/tenants" className="flex items-center">
            <ChevronLeft className="w-3 h-3" />
          </Link>
        }
        mainIcon={<Megaphone className="w-12 h-12" />}
        rightIcon={<Sparkles className="w-4 h-4" />}
        heading={tenant.name}
        placeholder="Tenant details"
      />

      <TenantDetailClient tenant={tenant} />
    </div>
  )
}

export default page
