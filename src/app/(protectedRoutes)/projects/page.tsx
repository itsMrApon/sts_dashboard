import React from 'react'
import { userCanGoLive } from '@/lib/billing/paidAccess'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Webcam, MessageCircle, HomeIcon } from 'lucide-react'
import PageHeader from '@/components/ReusableComponent/PageHeader'
import { onAuthenticateUser } from '@/actions/auth'
import ProjectCard from './_components/ProjectCard '
import ProjectsEmptyState from './_components/ProjectsEmptyState'
import { ProjectWizard } from './_components/ProjectWizard'
import { Button } from '@/components/ui/button'
import { publicBaseUrl } from '@/lib/offers/publicBaseUrl'
import { listCreatorOffers, parseOfferFilter, type OfferFilter } from '@/lib/offers/creatorOffers'
import { cn } from '@/lib/utils'

type Props = {
  searchParams: Promise<{ filter?: string }>
}

const FILTER_TABS: { value: OfferFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'products', label: 'Products' },
  { value: 'webinars', label: 'Webinars' },
  { value: 'ended', label: 'Ended' },
]

/** Products and webinars: one card each, filtered via ?filter=. The project popup opens with ?new=1 or ?edit=<id>. */
const page = async ({ searchParams }: Props) => {
  const [{ filter: filterParam }, checkUser] = await Promise.all([
    searchParams,
    onAuthenticateUser(),
  ])

  if (!checkUser.user) {
    redirect('/')
  }

  const filter = parseOfferFilter(filterParam)

  // Default path: offers list only (cached). Stripe/LiveKit only when the legacy launcher opens.
  const [offers, canGoLive] = await Promise.all([
    listCreatorOffers(checkUser.user.id, filter),
    // A plan, or the creator's own Gemini key (free).
    userCanGoLive(checkUser.user.id),
  ])

  const shareBaseUrl = publicBaseUrl()

  return (
    <>
      <ProjectWizard canCreate={canGoLive} />
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
            <Link
              href="/projects/questions"
              className="rounded-md bg-secondary px-5 py-2.5 text-sm opacity-50 transition-opacity hover:opacity-80"
            >
              General questions
            </Link>
            {canGoLive ? (
              <Button asChild size="sm">
                <Link href={`/projects?${filter === 'all' ? '' : `filter=${filter}&`}new=1`} scroll={false}>
                  + New
                </Link>
              </Button>
            ) : null}
          </nav>
        </PageHeader>

        {offers.length > 0 ? (
          <div className="grid w-full grid-cols-1 place-content-start place-items-start gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {offers.map((offer) => (
              <ProjectCard key={offer.id} project={offer} shareBaseUrl={shareBaseUrl} />
            ))}
          </div>
        ) : (
          <ProjectsEmptyState filter={filter} canCreate={canGoLive} />
        )}
      </div>
    </>
  )
}

export default page
