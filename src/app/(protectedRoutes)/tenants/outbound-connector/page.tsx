import { redirect } from 'next/navigation'

type PageProps = {
  searchParams: Promise<{ tenantId?: string; publishProfileId?: string }>
}

const page = async ({ searchParams }: PageProps) => {
  const { tenantId, publishProfileId } = await searchParams
  const qs = new URLSearchParams()
  if (tenantId) qs.set('tenantId', tenantId)
  if (publishProfileId) qs.set('publishProfileId', publishProfileId)
  redirect(`/tenants/publish${qs.toString() ? `?${qs.toString()}` : ''}`)
}

export default page
