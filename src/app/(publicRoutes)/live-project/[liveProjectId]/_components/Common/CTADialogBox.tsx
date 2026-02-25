import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ChevronRight, Loader2, Play } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import { WebinarWithPresenter } from '@/lib/type'
import { toast } from 'sonner'
import { createCheckoutLink } from '@/actions/stripe'

type Props = {
  open?:boolean
  onOpenChange?:(open: boolean)=> void
  trigger?: React.ReactNode 
  project:WebinarWithPresenter
  userId:string
}

const CTADialogBox = ({
  open, 
  onOpenChange, 
  trigger, 
  project,
  userId,
}: Props) => {
  const router = useRouter()
  const[loading, setLoading] = useState(false)

  const handleClick = async () => {
    try {
      if(project?.ctaType === 'BOOK_A_CALL') {
        router.push(`/live-project/${project.id}/call?attendeeId=${userId}`)
      } else {
        if (!project.priceId || !project.presenter.stripeConnectId) {
          return toast.error('No priceld or stripeConnectId found' )
        }

        const session = await createCheckoutLink(
          project.priceId, 
          project.presenter.stripeConnectId, 
          userId,
          project.id, 
          true
        )
        if (!session.sessionUrl) {
          throw new Error(`session ID is missing` )
        }
        window.open(session.sessionUrl, '_blank')
      }
    } catch (error) {
      console.error('Error redirecting to CTA page:', error)
      toast.error('Failed to redirect to CTA page')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md bg-card text-card-foreground border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">
            {project?.ctaType === 'BOOK_A_CALL' ? 'Book a Call' : 'Get Now'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {project?.ctaType === 'BOOK_A_CALL' 
            ? 'You will be redirected to a call on another page' 
            : 'You will be redirected to checkout'}
          </p>
        </DialogHeader>
        <div className="flex mt-4 space-x-4" >
          <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center">
              <Play />
            </div>
          </div>

          <div className="flex-1">
            <h3 className="text-sm font-medium" >{project?.title}</h3>
            <p className="text-xs text-muted-foreground mt-1">
               {project.description}
            </p>
          </div>
        </div>
        <DialogFooter className="flex justify-between items-center mt-4 sm:mt-0">
          <DialogClose>Close</DialogClose>  
          <Button
            onClick={handleClick}
            disabled={loading}
            className="flex items-center"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ): project?.ctaType === 'BOOK_A_CALL' ? (
              'Join Break-room'
            ) : (
              'Buy Now'
            )}{' '}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CTADialogBox