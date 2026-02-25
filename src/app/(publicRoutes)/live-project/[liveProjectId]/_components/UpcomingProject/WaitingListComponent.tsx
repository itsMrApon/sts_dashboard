'use client'
import { registerAttendee } from '@/actions/attendance'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useAttendeeStore } from '@/store/useAttendeeStore'
import { WebinarStatusEnum } from '@prisma/client'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import { toast } from 'sonner'

type Props = {
  projectId: string
  projectStatus: WebinarStatusEnum
  onRegistered: () => void
}

const WaitingListComponent = ({ projectId, projectStatus, onRegistered }: Props) => {

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const router = useRouter()

  const{setAttendee} = useAttendeeStore()

  const buttonText = () => {
    switch (projectStatus) {
      case WebinarStatusEnum.SCHEDULED:
        return 'Get Reminder'
      case WebinarStatusEnum.WAITING_ROOM:
        return 'Remind me when it starts'
      case WebinarStatusEnum.LIVE:
        return 'Join Project'
      default:
        return 'Register'
    }
  }

  const handleSubmit = async(e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await registerAttendee({
        email,
        name,
        projectId,
      })
      if (!res.success) {
        throw new Error(res.message || 'Failed to register attendee')
      }
      if (res.data?.user) {
        setAttendee(res.data.user)
      }
      toast.success(
        projectStatus === WebinarStatusEnum.LIVE 
        ? 'You can join the project now'
        : 'You are now in the waiting list'
      )
      setEmail('')
      setName('')
      setSubmitted(true)

      setTimeout(() => {
        setIsOpen(false)

        // If webinar is Live,refresh the page to enter the Livestream
        if (projectStatus === WebinarStatusEnum.LIVE) {
          router.refresh()
        }
        if(onRegistered) onRegistered()
      }, 1500)
    } catch (error) {
      console.error('Error registering attendee', error)
      toast.error(
        error instanceof Error ? error.message : 'something went wrong'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <DialogTrigger asChild>
        <Button
          className={`&{
              projectStatus === WebinarStatusEnum.SCHEDULED 
              ? 'bg-red-600 hover:bg-red-700' 
              : 'bg-primary hover:bg-primary/90'
          }rounded-md px-4 py-2 text-primary-foreground text-sm font-semibold`}
        >
          {projectStatus === WebinarStatusEnum.LIVE && (
            <span className="mr-2 h-2 w-2 bg-white rounded-full animate-pulse"></span>
          )}
          {buttonText()}
          </Button>
      </DialogTrigger>
      <DialogContent
        className="border-0 bg-transparent"
        isHideCloseButton={true}
      >
        <DialogHeader className="justify-center items-center border border-input rounded-xl p-4 bg-background">
          <DialogTitle className="text-center text-lg font-semibold mb-4">
            {projectStatus === WebinarStatusEnum.LIVE 
            ? 'Project is live' 
            : 'Project waitinglist'}
          </DialogTitle>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
            {!submitted &&(
              <React.Fragment>
                <Input
                  type="text"
                  placeholder="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </React.Fragment>
            )}
            <Button 
              type="submit" 
              className="w-full"
              disabled={isSubmitting || submitted}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin mr-2" />{''}
                  {projectStatus === WebinarStatusEnum.LIVE 
                  ? 'Joining the project...' 
                  : 'Registering...'}
                </>
              ) : submitted ? (
                projectStatus === WebinarStatusEnum.LIVE ? (
                "You are now set to join!"
                ):(
                  "You've successfully joined the waitlist!"
                )  
              ):(
                projectStatus === WebinarStatusEnum.LIVE
                  ? 'Join Project'
                  : 'Join the waitlist'
              )}
            </Button>
          </form>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}

export default WaitingListComponent