import { notFound, redirect } from 'next/navigation'
import { getHuntedLeadProfile } from '@/actions/leads'
import { HuntedLeadProfile } from '../_components/HuntedLeadProfile'

type Props = {
  params: Promise<{ leadId: string }>
}

export default async function HuntedLeadPage({ params }: Props) {
  const { leadId } = await params
  if (!leadId) redirect('/lead')

  const lead = await getHuntedLeadProfile(leadId)
  if (!lead) notFound()

  return (
    <div className="flex min-h-[70vh] w-full flex-col">
      <HuntedLeadProfile lead={lead} />
    </div>
  )
}
