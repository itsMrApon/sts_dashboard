import { notFound, redirect } from 'next/navigation'
import { onAuthenticateUser } from '@/actions/auth'
import { getOfferSettingsForOwner } from '@/lib/offers/offerSettings'
import { OfferSettings } from './_components/OfferSettings'

type Props = { params: Promise<{ projectId: string }> }

/** Offer settings: details, price options, ways to order, business/website and share links. */
export default async function OfferSettingsPage({ params }: Props) {
  const [{ projectId }, auth] = await Promise.all([params, onAuthenticateUser()])
  if (!auth.user) redirect('/sign-in')
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) notFound()

  const offer = await getOfferSettingsForOwner(projectId, auth.user.id)
  if (!offer) notFound()

  // key: form state is seeded from props, so a different offer must get a fresh form.
  return <OfferSettings key={offer.id} offer={offer} />
}
