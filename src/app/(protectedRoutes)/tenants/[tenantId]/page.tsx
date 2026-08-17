import { notFound, redirect } from 'next/navigation'
import { getTenantById } from '@/actions/tenants'

type Props = {
  params: Promise<{ tenantId: string }>
}

/** Legacy workspace URL — stay on the partners console. */
const page = async ({ params }: Props) => {
  const { tenantId } = await params
  const tenant = await getTenantById(tenantId)
  if (!tenant) notFound()
  redirect(`/tenants?tenantId=${tenant.id}`)
}

export default page
