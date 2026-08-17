import { redirect } from 'next/navigation'

type PageProps = {
  searchParams: Promise<{ publishProfileId?: string; tenantId?: string }>
}

/** Legacy route — publish is on the Messages room. */
export default async function BusinessProfileRedirect({ searchParams }: PageProps) {
  const { publishProfileId, tenantId } = await searchParams
  const params = new URLSearchParams()
  if (tenantId) params.set('tenantId', tenantId)
  else if (publishProfileId) params.set('publishProfileId', publishProfileId)
  const qs = params.toString()
  redirect(`/tenants/publish${qs ? `?${qs}` : ''}`)
}
