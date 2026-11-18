import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Webcam, MessageCircle, HomeIcon } from 'lucide-react'
import PageHeader from '@/components/ReusableComponent/PageHeader'
import { onAuthenticateUser } from '@/actions/auth'
import ProjectCard from './_components/ProjectCard '
import ProjectsEmptyState from './_components/ProjectsEmptyState'
import ProjectIntentLauncher from './_components/ProjectIntentLauncher'
import { publicBaseUrl } from '@/lib/offers/publicBaseUrl'
import { listCreatorOffers, parseOfferFilter, type OfferFilter } from '@/lib/offers/creatorOffers'
import { cn } from '@/lib/utils'

type Props = {
  searchParams: Promise<{
    filter?: string
    tenantId?: string
    intent?: string
    openAdd?: string
  }>
}

const FILTER_TABS: { value: OfferFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'products', label: 'Products' },
  { value: 'webinars', label: 'Webinars' },
  { value: 'ended', label: 'Ended' },
]

/** Products and webinars: one card each, filtered by type (or ended webinars) via ?filter=. */
const page = async ({ searchParams }: Props) => {
  const [{ filter: filterParam, tenantId, intent, openAdd }, checkUser] = await Promise.all([
    searchParams,
    onAuthenticateUser(),
  ])

  if (!checkUser.user) {
    redirect('/')
  }

  const filter = parseOfferFilter(filterParam)
  const shouldAutoLaunch = openAdd === '1' && (intent === 'product' || intent === 'webinar')

  // Default path: offers list only (cached). Stripe/LiveKit only when the legacy launcher opens.
  const offers = await listCreatorOffers(checkUser.user.id, filter)

  let stripeProducts: unknown[] = []
  let livekitAgents: unknown[] = []

  if (shouldAutoLaunch) {
    const [{ getAllProductsFromStripe }, { getLiveKitAgents }] = await Promise.all([
      import('@/actions/stripe'),
      import('@/actions/livekitAgent'),
    ])
    const launcherData = await Promise.all([getAllProductsFromStripe(), getLiveKitAgents()])
    stripeProducts =
      launcherData[0]?.success && Array.isArray(launcherData[0].products)
        ? launcherData[0].products
        : []
    livekitAgents =
      launcherData[1]?.success && Array.isArray(launcherData[1].data)
        ? launcherData[1].data
        : []
  }

  const shareBaseUrl = publicBaseUrl()

  return (
    <>
      {shouldAutoLaunch ? (
        <ProjectIntentLauncher
          intent={intent as 'product' | 'webinar'}
          tenantId={tenantId}
          stripeProducts={stripeProducts as never}
          livekitAgents={livekitAgents as never}
        />
      ) : null}
      <div className="flex w-full flex-col gap-8">
        <PageHeader
          leftIcon={<HomeIcon className="h-3 w-3" />}
          mainIcon={<Webcam className="h-12 w-12" />}
          rightIcon={<MessageCircle className="h-4 w-4" />}
          heading="Your products & webinars"
          mobileHeading="Projects"
          hideSearch
        >
          <nav aria-label="Filter projects" className="flex flex-wrap gap-2">
            {FILTER_TABS.map((tab) => (
              <Link
                key={tab.value}
                href={tab.value === 'all' ? '/projects' : `/projects?filter=${tab.value}`}
                aria-current={filter === tab.value ? 'page' : undefined}
                className={cn(
                  'rounded-md bg-secondary px-5 py-2.5 text-sm transition-opacity',
                  filter === tab.value ? 'font-medium opacity-100' : 'opacity-50 hover:opacity-80',
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </PageHeader>

        {offers.length > 0 ? (
          <div className="grid w-full grid-cols-1 place-content-start place-items-start gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {offers.map((offer) => (
              <ProjectCard key={offer.id} project={offer} shareBaseUrl={shareBaseUrl} />
            ))}
          </div>
        ) : (
          <ProjectsEmptyState filter={filter} canCreate={!!checkUser.user.subscription} />
        )}
      </div>
    </>
  )
}

export default page
