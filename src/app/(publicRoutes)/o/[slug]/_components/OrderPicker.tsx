'use client'

import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { startBuyerCheckout } from '@/actions/buyer'
import { describePrice, type PublicOfferView } from '@/lib/offers/publicOfferTypes'

type Props = {
  offer: PublicOfferView
  source: string | null
  /** Which way to order brought the buyer here (recorded on the Order). */
  via: 'INSTANT_CHECKOUT' | 'AI_ASSISTANT'
  label?: string
}

/** Price choice (when there is more than one) + "Continue to payment" → Stripe. */
export function OrderPicker({ offer, source, via, label = 'Continue to payment' }: Props) {
  const [priceId, setPriceId] = useState<string | null>(
    offer.prices.find((price) => price.isDefault)?.id ?? offer.prices[0]?.id ?? null,
  )
  const [busy, setBusy] = useState(false)

  const checkout = async () => {
    setBusy(true)
    try {
      const result = await startBuyerCheckout({ slug: offer.slug, offerPriceId: priceId, source, via })
      if (!result.ok) {
        toast.error(result.error)
        setBusy(false)
        return
      }
      window.location.href = result.url
    } catch {
      toast.error("Couldn't open checkout")
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {offer.prices.length > 1 ? (
        <div className="space-y-2" role="radiogroup" aria-label="Payment option">
          {offer.prices.map((option) => {
            const text = describePrice(option)
            const selected = priceId === option.id
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={text.detail ? `${text.title}, ${text.detail}` : text.title}
                onClick={() => setPriceId(option.id)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                  selected ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/40',
                )}
              >
                <span>
                  <span className="block font-medium">{text.title}</span>
                  {text.detail ? <span className="block text-xs text-muted-foreground">{text.detail}</span> : null}
                </span>
                <span
                  className={cn(
                    'h-4 w-4 shrink-0 rounded-full border',
                    selected ? 'border-[5px] border-primary' : 'border-muted-foreground/50',
                  )}
                />
              </button>
            )
          })}
        </div>
      ) : null}
      <Button className="w-full" onClick={checkout} disabled={!offer.acceptingPayments || busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {label}
      </Button>
      {!offer.acceptingPayments ? (
        <p className="text-xs text-muted-foreground">
          Online payment isn&apos;t set up yet. {offer.business.name} will contact you.
        </p>
      ) : null}
    </div>
  )
}
