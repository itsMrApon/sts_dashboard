import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { OfferFilter } from '@/lib/offers/creatorOffers'

const COPY: Record<OfferFilter, string> = {
  all: 'No products or webinars yet.',
  products: 'No products yet.',
  webinars: 'No upcoming webinars.',
  ended: 'No ended webinars yet.',
}

/** Empty list: say what is missing for this filter and open the project popup on the matching type. */
export default function ProjectsEmptyState({ filter, canCreate }: { filter: OfferFilter; canCreate: boolean }) {
  const type = filter === 'products' ? 'product' : filter === 'webinars' ? 'webinar' : null
  return (
    <div className="flex min-h-[200px] w-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border p-8 text-center">
      <p className="text-lg font-semibold text-primary">{COPY[filter]}</p>
      {filter === 'ended' ? (
        <Link href="/projects" className="text-sm text-muted-foreground underline underline-offset-4">
          See all projects
        </Link>
      ) : canCreate ? (
        <Button asChild>
          <Link href={`/projects?new=1${type ? `&type=${type}` : ''}`} scroll={false}>
            {type === 'product' ? '+ Create a product' : type === 'webinar' ? '+ Create a webinar' : '+ Create one'}
          </Link>
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">Subscribe (top right) to start selling.</p>
      )}
    </div>
  )
}
