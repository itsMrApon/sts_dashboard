import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { loadPublicOffer, toPublicView } from '@/lib/offers/publicOffer'
import { normalizeSource } from '@/lib/offers/leadInput'
import { PayButtons } from './_components/PayButtons'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ src?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const offer = await loadPublicOffer(slug)
  if (!offer?.live || !offer.modes.DIRECT_PAY) return { title: 'Payment link not active' }
  return { title: `Pay · ${offer.title}`, robots: { index: false } }
}

/**
 * Direct pay link: no form. Checkout starts on a tap, not on page load, so link previews
 * (WhatsApp, iMessage, Slack) never create orders or Stripe sessions.
 */
export default async function DirectPayPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const offer = await loadPublicOffer(slug)
  if (!offer) notFound()

  const active = offer.live && offer.modes.DIRECT_PAY
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-card p-6">
        <div className="space-y-1 text-center">
          <p className="text-sm text-muted-foreground">{offer.business.name}</p>
          <h1 className="text-xl font-semibold">{offer.title}</h1>
        </div>
        {active && offer.acceptingPayments ? (
          <PayButtons offer={toPublicView(offer)} source={normalizeSource(query.src)} />
        ) : (
          <p className="text-center text-sm text-muted-foreground">This payment link isn&apos;t active right now.</p>
        )}
        <p className="text-center text-xs text-muted-foreground">Secure checkout by Stripe · Powered by sts-ai</p>
      </div>
    </main>
  )
}
