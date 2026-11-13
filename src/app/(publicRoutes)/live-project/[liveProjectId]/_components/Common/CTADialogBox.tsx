import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ChevronRight, Loader2, ShoppingBag } from 'lucide-react'
import React, { useState } from 'react'
import { WebinarWithPresenter } from '@/lib/type'
import { toast } from 'sonner'
import { startLiveCheckout } from '@/actions/buyer'

type Props = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
  project: WebinarWithPresenter
  userId: string
}

/**
 * The offer the host drops during a live session: always Buy now, priced from the offer's
 * settings and recorded as a "Live with you" order. Checkout opens in a new tab so the buyer
 * stays in the session.
 */
const CTADialogBox = ({ open, onOpenChange, trigger, project, userId }: Props) => {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      const session = await startLiveCheckout({ webinarId: project.id, attendeeId: userId })
      if (!session.ok) {
        toast.error(session.error)
        return
      }
      window.open(session.url, '_blank')
    } catch (error) {
      console.error('Error opening live checkout:', error)
      toast.error('Could not open checkout')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md bg-card text-card-foreground border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Get it now</DialogTitle>
          <p className="mt-1 text-sm text-muted-foreground">Checkout opens in a new tab, so you won&apos;t miss the session.</p>
        </DialogHeader>
        <div className="mt-4 flex space-x-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-md bg-muted">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium">{project?.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{project.description}</p>
          </div>
        </div>
        <DialogFooter className="mt-4 flex items-center justify-between sm:mt-0">
          <DialogClose>Close</DialogClose>
          <Button onClick={handleClick} disabled={loading} className="flex items-center">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Opening checkout…
              </>
            ) : (
              'Buy now'
            )}{' '}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CTADialogBox
