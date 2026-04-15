'use client'

import { WebinarWithPresenter } from '@/lib/type'
import { Attendee } from '@prisma/client'
import { createCheckoutLink } from '@/actions/stripe'
import { Button } from '@/components/ui/button'
import { ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'

type Props = {
  product: WebinarWithPresenter
  attendee: Attendee
}

export default function ProductCheckout({ product, attendee }: Props) {
  const handleBuyNow = async () => {
    try {
      if (!product.priceId || !product.presenter?.stripeConnectId) {
        toast.error('Checkout not configured for this product')
        return
      }
      const session = await createCheckoutLink(
        product.priceId,
        product.presenter.stripeConnectId,
        attendee.id,
        product.id
      )
      if (session.sessionUrl) window.open(session.sessionUrl, '_blank')
      else toast.error('Could not create checkout session')
    } catch (e) {
      console.error(e)
      toast.error('Checkout failed')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card px-4 py-3">
        <h1 className="text-lg font-semibold truncate">{product.title}</h1>
        <p className="text-xs text-muted-foreground truncate">
          {attendee.name} · {attendee.email}
        </p>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-lg mx-auto w-full">
        {product.description && (
          <p className="text-muted-foreground text-center mb-8">
            {product.description}
          </p>
        )}
        <Button
          size="lg"
          className="w-full sm:w-auto min-w-[200px]"
          onClick={handleBuyNow}
        >
          <ShoppingBag className="h-5 w-5 mr-2" />
          Buy now — go to checkout
        </Button>
      </div>
    </div>
  )
}
