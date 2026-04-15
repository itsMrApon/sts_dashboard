'use client'

import { WebinarWithPresenter } from '@/lib/type'
import React, { useEffect, useRef, useState } from 'react'
import { Loader2, MessageSquare, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import dynamic from 'next/dynamic'
import { Attendee, User } from '@prisma/client'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createCheckoutLink } from '@/actions/stripe'
import { toast } from 'sonner'
import { getStreamIoToken } from '@/actions/streamIo'
import { Channel as StreamChannel, StreamChat } from 'stream-chat'
import { Chat, Channel, MessageInput, MessageList } from 'stream-chat-react'
import 'stream-chat-react/dist/css/v2/index.css'

const LiveKitCall = dynamic(
  () => import('@/app/(publicRoutes)/live-project/[liveProjectId]/call/_components/LiveKitCall'),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full min-h-[300px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> }
)
const AutoConnectCall = dynamic(
  () => import('@/app/(publicRoutes)/live-project/[liveProjectId]/call/_components/AutoConnectCall'),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full min-h-[300px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> }
)

type Props = {
  user: User | null
  product: WebinarWithPresenter
  attendee: Attendee
  livekitRoomName: string | null
  livekitAssistantName: string | null
}

export default function ProductExperience({
  user,
  product,
  attendee,
  livekitRoomName,
  livekitAssistantName,
}: Props) {
  const [chatClient, setChatClient] = useState<StreamChat | null>(null)
  const [channel, setChannel] = useState<StreamChannel | null>(null)
  const [showChat, setShowChat] = useState(false)
  const clientRef = useRef<StreamChat | null>(null)

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

  const hasLiveKit = !!livekitRoomName
  const hasVapi = !!product.aiAgentId
  const [showPostCallDialog, setShowPostCallDialog] = useState(false)

  // Connect Stream chat on mount so it's always visible on the right
  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        const t = await getStreamIoToken(attendee)
        if (!mounted) return
        const client = StreamChat.getInstance(
          process.env.NEXT_PUBLIC_STREAM_API_KEY as string
        )
        clientRef.current = client
        await client.connectUser(
          { id: attendee.id, name: attendee.name },
          t
        )
        if (!mounted) return
        const ch = client.channel('livestream', product.id, {
          name: product.title,
        })
        await ch.watch()
        if (!mounted) return
        setChatClient(client)
        setChannel(ch)
      } catch (e) {
        console.error('Stream init error (product attendee):', e)
      }
    }
    init()

    return () => {
      mounted = false
      if (clientRef.current) {
        clientRef.current.disconnectUser()
        clientRef.current = null
      }
    }
  }, [attendee.id, attendee.name, product.id, product.title])

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0 flex-wrap gap-2">
        <div className="flex flex-col min-w-0">
          <h1 className="text-lg font-semibold truncate">{product.title}</h1>
          <p className="text-xs text-muted-foreground truncate">
            {attendee.name} · {attendee.email}
            {user && ` · Account: ${user.name}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleBuyNow}>
            <ShoppingBag className="h-4 w-4 mr-1" />
            Buy Now
          </Button>
          <Button
            variant={showChat ? 'default' : 'outline'}
            size="sm"
            className="flex items-center gap-1"
            onClick={() => setShowChat((v) => !v)}
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">{showChat ? 'Hide chat' : 'Chat'}</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col p-4 min-h-0 overflow-hidden">
        <div
          className={`flex-1 grid gap-4 min-h-[280px] overflow-hidden ${
            showChat ? 'grid-cols-[minmax(0,1fr)_18rem]' : 'grid-cols-[minmax(0,1fr)]'
          }`}
        >
          {/* Left: AI / voice experience */}
          <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col min-h-[280px]">
            {hasLiveKit && livekitRoomName && livekitAssistantName && (
              <LiveKitCall
                roomName={livekitRoomName}
                userName={attendee.name}
                assistantName={livekitAssistantName}
                callTimeLimit={180}
                project={product}
                userId={attendee.id}
                hideBuyNow
                onCallEnd={() => setShowPostCallDialog(true)}
              />
            )}
            {!hasLiveKit && hasVapi && (
              <AutoConnectCall
                userName={attendee.name}
                assistantId={product.aiAgentId!}
                assistantName="AI Assistant"
                assistantImage=""
                callTimeLimit={180}
                project={product}
                userId={attendee.id}
                hideBuyNow
                onCallEnd={() => setShowPostCallDialog(true)}
              />
            )}
            {!hasLiveKit && !hasVapi && (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No voice agent configured
              </div>
            )}
          </div>

          {/* Right: Stream chat, same style as project, controlled by showChat */}
          {showChat && (
            <div className="h-full min-h-0">
              {chatClient && channel ? (
                <Chat client={chatClient}>
                  <Channel channel={channel}>
                    <div className="w-full h-full bg-card border border-border rounded-xl overflow-hidden flex flex-col">
                      <div className="py-2 text-primary px-3 border-b border-border font-medium flex items-center justify-between bg-muted/60">
                        <span className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          <span>Chat</span>
                        </span>
                      </div>
                      <MessageList />
                      <div className="p-2 border-t border-border">
                        <MessageInput />
                      </div>
                    </div>
                  </Channel>
                </Chat>
              ) : (
                <div className="w-full h-full bg-card border border-border rounded-xl overflow-hidden flex items-center justify-center text-muted-foreground gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading chat…
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={showPostCallDialog} onOpenChange={setShowPostCallDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Call ended</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            If the session was helpful, you can purchase this product now. You can also close this and explore more.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPostCallDialog(false)}
            >
              Maybe later
            </Button>
            <Button onClick={handleBuyNow}>
              <ShoppingBag className="h-4 w-4 mr-1" />
              Buy Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chat is now embedded on the right (desktop) */}
    </div>
  )
}
