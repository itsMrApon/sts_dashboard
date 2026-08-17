import { redirect } from 'next/navigation'

type PageProps = {
  searchParams: Promise<{ tenantId?: string; kind?: string }>
}

export default async function InboundConnectorPage({ searchParams }: PageProps) {
  const { tenantId, kind } = await searchParams
  if (!kind) {
    redirect('/tenants')
  }
  const qs = new URLSearchParams({ kind })
  if (tenantId) qs.set('tenantId', tenantId)
  redirect(`/tenants/partners?${qs.toString()}`)
}
