'use client'

import { useState } from 'react'
import { ChevronRight, Loader2, ShoppingBag } from 'lucide-react'
import { toast } from '@/lib/toast'
import { startLiveCheckout } from '@/actions/buyer'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  webinarId: string
  attendeeId: string
  title: string
  description: string
  acceptingPayments: boolean
}

/**
 * The offer the host drops during the session: Buy now, recorded as a "Live with you" order.
 * Checkout opens in a new tab so the viewer stays in the session.
 */
export function OfferDropDialog({ open, onOpenChange, webinarId, attendeeId, title, description, acceptingPayments }: Props) {
  const [loading, setLoading] = useState(false)

  const buy = async () => {
    setLoading(true)
    try {
      const result = await startLiveCheckout({ webinarId, attendeeId })
      if (!result.ok) return void toast.error(result.error)
      window.open(result.url, '_blank', 'noopener,noreferrer')
      onOpenChange(false)
    } catch {
      toast.error("Couldn't open checkout")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Get it now</DialogTitle>
          <DialogDescription>Checkout opens in a new tab, so you won&apos;t miss the session.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
            <ShoppingBag className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="font-medium">{title}</p>
            {description ? <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={() => onOpenChange(false)} className="rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
            Not now
          </button>
          <button
            type="button"
            onClick={() => void buy()}
            disabled={loading || !acceptingPayments}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {acceptingPayments ? 'Buy now' : 'Payments not open yet'}
            {acceptingPayments ? <ChevronRight className="h-4 w-4" aria-hidden /> : null}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
