'use client'

import { useId, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bot, Hash, MessageCircle, Package, X } from 'lucide-react'
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

/** Messaging hub row from getPublishProfiles — shown as a “room” in the UI */
export type RoomCardData = {
  id: string
  name: string
  description: string | null
  agents: {
    isPrimary: boolean
    agent: { id: string; name: string; roomName: string }
  }[]
  products: {
    isPrimary: boolean
    webinar: { id: string; title: string; kind: string }
  }[]
  productsCount?: number
  channels: { roomName: string }[]
  _count: { channels: number }
}

type Props = {
  room: RoomCardData
  /** When embedded on the main Messages page, configuration sits below the header. */
  embedded?: boolean
  roomName?: string | null
}

const RoomCard = ({ room, embedded = false, roomName: roomNameProp }: Props) => {
  const productsCount = room.productsCount ?? room.products.length
  const router = useRouter()
  const headingId = useId()
  const [removeOpen, setRemoveOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const primaryAgent = room.agents.find((a) => a.isPrimary) || room.agents[0]
  const roomFromAgent = primaryAgent?.agent.roomName
  const roomFromChannel = room.channels[0]?.roomName
  const messagingRoomName = roomNameProp ?? roomFromAgent ?? roomFromChannel ?? null

  const configureHref = messagingRoomName
    ? `/messages?room=${encodeURIComponent(messagingRoomName)}`
    : `/messages/publish`

  const handleRemove = () => {
    if (!messagingRoomName) return
    startTransition(async () => {
      const result = await removeMessagingRoom(messagingRoomName)
      if (!result.ok) {
        toast.error(
          result.error === 'FORBIDDEN'
            ? 'You cannot remove this room.'
            : result.error || 'Could not remove room',
        )
        return
      }
      setRemoveOpen(false)
      toast.success('Room removed from Messages')
      router.refresh()
    })
  }

  const shellClass = embedded
    ? 'relative w-full min-w-0'
    : 'relative w-full min-w-0 rounded-2xl border border-border bg-card shadow-sm transition-colors hover:border-primary/50'

  const bodyClass = embedded
    ? 'flex w-full min-w-0 flex-col gap-4 p-4 pt-3 sm:p-5 sm:pr-14 sm:pt-4'
    : 'group flex w-full min-w-0 flex-col gap-4 rounded-2xl p-4 pt-3 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring sm:p-5 sm:pr-14 sm:pt-4'

  const inner = (
    <>
      {messagingRoomName && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 z-10 h-9 w-9 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Remove room ${room.name} from Messages`}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setRemoveOpen(true)
            }}
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>

          <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove this room?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes messaging channels for @{messagingRoomName} and unlinks linked AI
                  agents from this hub. Agents and profiles stay in AI Agents and Workspaces — use{' '}
                  <strong>New room</strong> to connect again.
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
        </>
      )}

      <div className={bodyClass} aria-describedby={room.description ? `${headingId}-desc` : undefined}>
        <div className="flex w-full min-w-0 items-start gap-3 sm:gap-4">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
            aria-hidden
          >
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-1 pr-2 sm:pr-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Room
            </p>
            <h2 id={headingId} className="text-base font-semibold leading-snug text-foreground">
              {room.name}
            </h2>
            {messagingRoomName && (
              <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Hash className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate font-mono">{messagingRoomName}</span>
              </p>
            )}
            {room.description && (
              <p id={`${headingId}-desc`} className="text-sm leading-relaxed text-muted-foreground">
                {room.description}
              </p>
            )}
          </div>
        </div>

        <div
          className="flex w-full min-w-0 flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/60 pt-3 text-xs text-muted-foreground"
          role="group"
          aria-label="Room summary"
        >
          <span className="inline-flex items-center gap-1.5">
            <Bot className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {room.agents.length} agent{room.agents.length !== 1 ? 's' : ''}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {productsCount} project{productsCount !== 1 ? 's' : ''}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {room._count.channels} channel{room._count.channels !== 1 ? 's' : ''}
            </span>
          </span>
        </div>

        {(room.agents.length > 0 || room.products.length > 0) && (
          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-2">
            {room.agents.length > 0 && (
              <div className="flex min-w-0 flex-wrap gap-1.5" role="list" aria-label="Linked agents">
                {room.agents.map((ba) => (
                  <span
                    key={ba.agent.id}
                    role="listitem"
                    className={`inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[10px] ${
                      ba.isPrimary
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {ba.agent.name}
                    {ba.isPrimary ? ' ★' : ''}
                  </span>
                ))}
              </div>
            )}
            {room.products.length > 0 && (
              <div className="flex min-w-0 flex-wrap gap-1.5" role="list" aria-label="Linked projects">
                {room.products.slice(0, 5).map((bp) => (
                  <span
                    key={bp.webinar.id}
                    role="listitem"
                    className="inline-flex max-w-full truncate rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-400"
                  >
                    {bp.webinar.title}
                  </span>
                ))}
                {productsCount > 5 && (
                  <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    +{productsCount - 5} more
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {!embedded && (
          <div className="flex w-full justify-end border-t border-border/60 pt-3">
            <span className="text-sm font-medium text-primary underline-offset-4 group-hover:underline">
              Configure
              <span aria-hidden> →</span>
            </span>
          </div>
        )}
      </div>
    </>
  )

  if (embedded) {
    return <div className={shellClass}>{inner}</div>
  }

  return (
    <article className={shellClass} aria-labelledby={headingId}>
      <Link href={configureHref} className="block">
        {inner}
      </Link>
    </article>
  )
}

export default RoomCard
