'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import StreamChatHistoryLazy from '@/components/ReusableComponent/StreamChatHistoryLazy'
import { getTokenForHost } from '@/actions/streamIo'

type Props = {
  channelId: string
  channelName: string
  hostUser: {
    id: string
    name: string
    profileImage: string
  }
}

export default function ProjectChatSheet({ channelId, channelName, hostUser }: Props) {
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canFetch = useMemo(() => !!hostUser?.id && !!hostUser?.name, [hostUser])

  useEffect(() => {
    if (!open) return
    if (!canFetch) return
    if (token) return

    let mounted = true
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const t = await getTokenForHost(hostUser.id, hostUser.name, hostUser.profileImage)
        if (!mounted) return
        setToken(t)
      } catch (e) {
        console.error(e)
        if (!mounted) return
        setError('Could not load chat.')
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [open, canFetch, token, hostUser.id, hostUser.name, hostUser.profileImage])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-md hover:bg-secondary"
        onClick={() => setOpen(true)}
        aria-label="Open chat"
      >
        <MessageCircle className="h-5 w-5" />
      </Button>

      <SheetContent side="right" className="w-[min(720px,92vw)] sm:max-w-none p-0">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Chat · {channelName}</SheetTitle>
        </SheetHeader>
        <div className="p-4">
          {error ? (
            <div className="h-[360px] flex items-center justify-center text-muted-foreground">
              {error}
            </div>
          ) : !token || loading ? (
            <div className="h-[360px] flex items-center justify-center text-muted-foreground">
              Loading chat…
            </div>
          ) : (
            <StreamChatHistoryLazy
              channelId={channelId}
              channelName={channelName}
              userId={hostUser.id}
              userName={hostUser.name}
              userToken={token}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

