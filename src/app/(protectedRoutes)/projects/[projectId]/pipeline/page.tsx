import { notFound, redirect } from 'next/navigation'
import { HomeIcon, Users } from 'lucide-react'
import { onAuthenticateUser } from '@/actions/auth'
import PageHeader from '@/components/ReusableComponent/PageHeader'
import PipelineIcon from '@/icons/PipelineIcon'
import { loadOfferPipeline } from '@/lib/offers/offerPipeline'
import { OfferPipeline } from './_components/OfferPipeline'

type Props = {
  params: Promise<{ projectId: string }>
}

/** The offer's pipeline: registrations, AI conversations (live) and orders. Owner only. */
export default async function PipelinePage({ params }: Props) {
  const [{ projectId }, auth] = await Promise.all([params, onAuthenticateUser()])
  if (!auth.user) redirect('/sign-in')
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) notFound()

  const view = await loadOfferPipeline(projectId, auth.user.id)
  if (!view) notFound()

  return (
    <div className="flex w-full flex-col gap-8">
      <PageHeader
        leftIcon={<Users className="h-4 w-4" />}
        mainIcon={<PipelineIcon className="h-12 w-12" />}
        rightIcon={<HomeIcon className="h-3 w-3" />}
        heading="Keep track of all of your customers"
        placeholder="Search Name, Tag or Email"
      />
      <OfferPipeline view={view} />
    </div>
  )
}
