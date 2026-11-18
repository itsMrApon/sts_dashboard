'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import type { OfferFilter } from '@/lib/offers/creatorOffers'

const AddServiceDialog = dynamic(() => import('@/components/ReusableComponent/AddService/AddServiceDialog'), {
  ssr: false,
  loading: () => <div className="h-9 w-36 animate-pulse rounded-xl bg-muted" />,
})

const COPY: Record<OfferFilter, string> = {
  all: 'No products or webinars yet.',
  products: 'No products yet.',
  webinars: 'No upcoming webinars.',
  ended: 'No ended webinars yet.',
}

/** Empty list: say what is missing for this filter and offer the matching Create button. */
export default function ProjectsEmptyState({ filter, canCreate }: { filter: OfferFilter; canCreate: boolean }) {
  const kind = filter === 'products' ? 'PRODUCT' : filter === 'webinars' ? 'WEBINAR' : undefined
  return (
    <div className="flex min-h-[200px] w-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border p-8 text-center">
      <p className="text-lg font-semibold text-primary">{COPY[filter]}</p>
      {filter === 'ended' ? (
        <Link href="/projects" className="text-sm text-muted-foreground underline underline-offset-4">
          See all projects
        </Link>
      ) : canCreate ? (
        <AddServiceDialog
          initialKind={kind}
          triggerLabel={kind === 'PRODUCT' ? 'Create a product' : kind === 'WEBINAR' ? 'Create a webinar' : 'Create'}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Pick a package (top right) to start selling.</p>
      )}
    </div>
  )
}
