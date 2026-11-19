'use client'

import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { startDirectPay } from '@/actions/buyer'
import { describePrice, type PublicOfferView } from '@/lib/offers/publicOfferTypes'

/** One button per price option; a tap goes straight to Stripe. */
export function PayButtons({ offer, source }: { offer: PublicOfferView; source: string | null }) {
  const [busy, setBusy] = useState<string | null>(null)
  const options = offer.prices.length ? offer.prices : [null]

  const pay = async (offerPriceId: string | null) => {
    setBusy(offerPriceId ?? 'default')
    try {
      const result = await startDirectPay({ slug: offer.slug, offerPriceId, source })
      if (!result.ok) {
        toast.error(result.error)
        setBusy(null)
        return
      }
      window.location.href = result.url
    } catch {
      toast.error("Couldn't open checkout")
      setBusy(null)
    }
  }

  return (
    <div className="space-y-2">
      {options.map((option, index) => {
        const key = option?.id ?? 'default'
        const text = option ? describePrice(option) : { title: 'Pay now', detail: null }
        return (
          <Button
            key={key}
            className="h-auto w-full flex-col gap-0.5 py-3"
            variant={index === 0 ? 'default' : 'outline'}
            disabled={busy !== null}
            onClick={() => void pay(option?.id ?? null)}
          >
            <span className="flex items-center text-base font-semibold">
              {busy === key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {option?.amountCents == null ? 'Pay now' : `Pay ${text.title}`}
            </span>
            {text.detail ? <span className="text-xs font-normal opacity-80">{text.detail}</span> : null}
          </Button>
        )
      })}
    </div>
  )
}
