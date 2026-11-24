import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { loadReviewRequest } from '@/lib/reviews/reviews'
import { PublicServiceShell, ServiceCard } from '../../_components/PublicServiceShell'
import { ReviewForm } from './_components/ReviewForm'

type Props = { params: Promise<{ token: string }> }

export const metadata: Metadata = { title: 'Leave a review', robots: { index: false } }

/** A customer's private review link. One review per link. */
export default async function ReviewPage({ params }: Props) {
  const { token } = await params
  const request = await loadReviewRequest(token)
  if (!request) notFound()

  return (
    <PublicServiceShell businessName={request.businessName} service="business" links={{}}>
      <ServiceCard className="p-6">
        {request.open ? (
          <ReviewForm
            token={token}
            businessName={request.businessName}
            projectTitle={request.projectTitle}
            defaultName={request.customerName ?? ''}
          />
        ) : (
          <div className="space-y-2 text-center">
            <h1 className="text-lg font-semibold">Thank you!</h1>
            <p className="text-sm text-zinc-400">This review was already sent to {request.businessName}.</p>
          </div>
        )}
      </ServiceCard>
    </PublicServiceShell>
  )
}
