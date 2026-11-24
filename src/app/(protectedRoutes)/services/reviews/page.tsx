import { redirect } from 'next/navigation'
import { onAuthenticateUser } from '@/actions/auth'
import { publicBaseUrl } from '@/lib/offers/publicBaseUrl'
import { listReviews, loadReviewSettings } from '@/lib/reviews/reviews'
import { ServicesShell } from '../_components/ServicesShell'
import { ReviewsManager } from './_components/ReviewsManager'

/** Services → Reviews: what customers wrote, which ones show on the website, and asking for more. */
export default async function ReviewsPage() {
  const auth = await onAuthenticateUser()
  if (!auth.user) redirect('/sign-in')
  const [reviews, settings] = await Promise.all([listReviews(auth.user.id), loadReviewSettings(auth.user.id)])
  const baseUrl = publicBaseUrl() || process.env.NEXT_PUBLIC_APP_URL || ''

  return (
    <ServicesShell title="Reviews">
      <ReviewsManager reviews={reviews} settings={settings} baseUrl={baseUrl} />
    </ServicesShell>
  )
}
