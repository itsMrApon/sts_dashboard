'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MessageCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { removeMessagingRoom } from '@/actions/messages'
import { toast } from 'sonner'

type Props = {
  agent: {
    id: string
    roomName: string
    name: string
  }
}

const AgentMessageCard = ({ agent }: Props) => {
  const router = useRouter()
  const [removeOpen, setRemoveOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const roomHref = `/messages/${encodeURIComponent(agent.roomName)}`

  const handleRemove = () => {
    startTransition(async () => {
      const result = await removeMessagingRoom(agent.roomName)
      if (!result.ok) {
        toast.error(
          result.error === 'FORBIDDEN'
            ? 'You cannot remove this room.'
            : result.error || 'Could not remove room',
        )
        return
      }
      setRemoveOpen(false)
      toast.success('Messaging room removed')
      router.refresh()
    })
  }

  return (
    <div className="relative rounded-2xl border border-border bg-card transition-colors hover:border-primary/60 hover:shadow-sm">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1 z-10 h-8 w-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label="Remove messaging room"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setRemoveOpen(true)
        }}
      >
        <X className="h-4 w-4" />
      </Button>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this messaging room?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes connected channels for @{agent.roomName} and unlinks the agent from your
              businesses. The agent stays in AI Agents — use New room on Messages to connect again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={isPending} onClick={() => handleRemove()}>
              {isPending ? 'Removing…' : 'Remove room'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Link
        href={roomHref}
        className="group flex min-h-[148px] flex-col gap-3 p-4 pr-10 pt-2"
      >
        <div className="flex items-start gap-3 pr-6">
          <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <MessageCircle className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 flex flex-col">
            <p className="font-medium truncate">{agent.name}</p>
            <p className="text-xs text-muted-foreground truncate">@{agent.roomName}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground flex-1">
          Connect Telegram, Discord, WhatsApp, Instagram, Facebook, YouTube, or TikTok to this agent.
        </p>
        <span className="self-end text-xs font-medium text-primary opacity-90 transition-opacity group-hover:opacity-100">
          Configure →
        </span>
      </Link>
    </div>
  )
}

export default AgentMessageCard
