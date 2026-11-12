'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { StripeElements } from '@/components/ReusableComponent/Stripe/Element'
import {
  confirmPackagePurchase,
  startPackagePurchase,
  type PackageCard,
} from '@/actions/platformBilling'
import type { PlatformPackageId } from '@/lib/billing/platformPackages'

type Props = {
  cards: PackageCard[]
  /** Called once access is granted (e.g. to close a dialog). */
  onPurchased?: () => void
}

const CARD_STYLE = {
  style: {
    base: { fontSize: '16px', color: '#B4B0E3', '::placeholder': { color: '#B4B0E3' } },
    invalid: { color: '#9e2146' },
  },
}

function CardCheckout({
  pkg,
  onCancel,
  onDone,
}: {
  pkg: PackageCard
  onCancel: () => void
  onDone: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [paying, setPaying] = useState(false)

  const pay = async () => {
    if (!stripe || !elements) return toast.error('Payments are still loading')
    const card = elements.getElement(CardElement)
    if (!card) return toast.error('Card form is not ready')

    setPaying(true)
    try {
      const started = await startPackagePurchase(pkg.id)
      if (!started.ok) throw new Error(started.error)

      const { error } = await stripe.confirmCardPayment(started.clientSecret, {
        payment_method: { card },
      })
      if (error) throw new Error(error.message || 'Card was declined')

      const confirmed = await confirmPackagePurchase({
        packageId: pkg.id,
        paymentIntentId: started.paymentIntentId,
      })
      if (!confirmed.ok) throw new Error(confirmed.error)

      toast.success(`${pkg.name} is active`)
      onDone()
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Payment failed')
    } finally {
      setPaying(false)
    }
  }

  return (
    <div className="space-y-3">
      <CardElement options={CARD_STYLE} className="w-full rounded-lg border border-input p-3" />
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={paying}>
          Cancel
        </Button>
        <Button className="flex-1" onClick={pay} disabled={paying || !stripe}>
          {paying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Pay {pkg.priceLabel}
        </Button>
      </div>
    </div>
  )
}

export default function PackagesPanel({ cards, onPurchased }: Props) {
  const [checkoutFor, setCheckoutFor] = useState<PlatformPackageId | null>(null)

  return (
    <StripeElements>
      {/* Two columns only when each card is wide enough for Stripe's single-line card field. */}
      <div className="grid gap-4 lg:grid-cols-2">
        {cards.map((pkg) => {
          const active = checkoutFor === pkg.id
          return (
            <div
              key={pkg.id}
              className={cn(
                'flex flex-col rounded-lg border border-border bg-background p-5',
                pkg.id === 'BUSINESS' && 'border-primary/40 bg-primary/5',
              )}
            >
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold">{pkg.name}</h3>
                <span className="whitespace-nowrap text-sm font-medium text-primary">
                  {pkg.priceLabel ?? 'Coming soon'}
                </span>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">{pkg.tagline}</p>
              <ul className="mb-5 space-y-2 text-sm">
                {pkg.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                {pkg.owned ? (
                  <p className="flex items-center gap-2 text-sm font-medium text-green-500">
                    <CheckCircle2 className="h-4 w-4" />
                    {pkg.id === 'SETUP' ? 'Purchased — we will contact you' : 'Active'}
                  </p>
                ) : active ? (
                  <CardCheckout
                    pkg={pkg}
                    onCancel={() => setCheckoutFor(null)}
                    onDone={() => {
                      setCheckoutFor(null)
                      onPurchased?.()
                    }}
                  />
                ) : (
                  <Button
                    className="w-full"
                    variant={pkg.id === 'BUSINESS' ? 'default' : 'outline'}
                    disabled={!pkg.priceLabel || checkoutFor !== null}
                    onClick={() => setCheckoutFor(pkg.id)}
                  >
                    {pkg.id === 'SETUP' ? 'Get set up' : 'Start monthly'}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </StripeElements>
  )
}
