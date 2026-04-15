'use client'

import { WebinarWithPresenter } from '@/lib/type'
import { Attendee } from '@prisma/client'
import { createCheckoutLink } from '@/actions/stripe'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

type Props = {
  product: WebinarWithPresenter
  attendee: Attendee
}

export default function BuyNowRedirect({ product, attendee }: Props) {
  const [status, setStatus] = useState<'redirecting' | 'error'>('redirecting')

  useEffect(() => {
    let mounted = true

    const go = async () => {
      if (!product.priceId || !product.presenter?.stripeConnectId) {
        if (mounted) {
          setStatus('error')
          toast.error('Checkout not configured for this product')
        }
        return
      }
      try {
        const session = await createCheckoutLink(
          product.priceId,
          product.presenter.stripeConnectId,
          attendee.id,
          product.id
        )
        if (!mounted) return
        if (session.sessionUrl) {
          window.location.href = session.sessionUrl
          return
        }
        setStatus('error')
        toast.error('Could not create checkout session')
      } catch (e) {
        console.error(e)
        if (mounted) {
          setStatus('error')
          toast.error('Checkout failed')
        }
      }
    }

    go()
    return () => {
      mounted = false
    }
  }, [product, attendee])

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <p className="text-muted-foreground">Checkout could not be started. Please try again or contact support.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-muted-foreground">Redirecting to checkout…</p>
    </div>
  )
}
