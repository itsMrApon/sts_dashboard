'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { WebinarWithPresenter } from '@/lib/type'
import { Button } from '@/components/ui/button'
import { Loader2, MessageSquare, ShoppingBag } from 'lucide-react'
import { getTokenForHost } from '@/actions/streamIo'
import { Channel as StreamChannel, StreamChat } from 'stream-chat'
import { Chat, Channel, MessageInput, MessageList } from 'stream-chat-react'
import 'stream-chat-react/dist/css/v2/index.css'

 type AttendeeListItem = {
   id: string
   name: string
   email: string
   lastSeenAt: Date | null
 }

type Props = {
  product: WebinarWithPresenter
  attendees: AttendeeListItem[]
}

 export default function CreatorProductRoom({ product, attendees }: Props) {
   const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(
     attendees[0]?.id ?? null
   )

  const [chatClient, setChatClient] = useState<StreamChat | null>(null)
  const [channel, setChannel] = useState<StreamChannel | null>(null)
  const [chatLoading, setChatLoading] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const clientRef = useRef<StreamChat | null>(null)

   const hostUser = useMemo(
     () => ({
       id: product.presenterId,
       name: product.presenter?.name ?? 'Host',
       profileImage: product.presenter?.profileImage ?? '',
     }),
     [product.presenterId, product.presenter?.name, product.presenter?.profileImage]
   )

   const selected = useMemo(
     () => attendees.find((a) => a.id === selectedAttendeeId) ?? null,
     [attendees, selectedAttendeeId]
   )

  // Connect Stream chat on mount so it's always visible on the right
  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        setChatLoading(true)
        const t = await getTokenForHost(hostUser.id, hostUser.name, hostUser.profileImage)
        const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY as string | undefined
        if (!apiKey) {
          console.error('Missing NEXT_PUBLIC_STREAM_API_KEY')
          return
        }
        const client = StreamChat.getInstance(apiKey)
        clientRef.current = client
        await client.connectUser(
          { id: hostUser.id, name: hostUser.name },
          t
        )
        if (!mounted) return
        const ch = client.channel('livestream', product.id, { name: product.title })
        await ch.watch()
        if (!mounted) return
        setChatClient(client)
        setChannel(ch)
      } catch (e) {
        console.error('Stream init error (creator product):', e)
      } finally {
        if (mounted) setChatLoading(false)
      }
    }
    void init()

    return () => {
      mounted = false
      if (clientRef.current) {
        clientRef.current.disconnectUser()
        clientRef.current = null
        setChatClient(null)
        setChannel(null)
      }
    }
  }, [hostUser.id, hostUser.name, hostUser.profileImage, product.id, product.title])

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header - matches existing app shell */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex flex-col min-w-0">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Creator view
            </p>
            <h1 className="text-lg font-semibold truncate">{product.title}</h1>
            <p className="text-xs text-muted-foreground truncate">
              Inbox for {hostUser.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            disabled
            className="text-xs"
          >
            <ShoppingBag className="h-4 w-4 mr-1" />
            Buy Now (customer only)
          </Button>
          <Button
            variant={showChat ? 'default' : 'outline'}
            size="sm"
            className="flex items-center gap-1 text-xs"
            onClick={() => setShowChat((v) => !v)}
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">{showChat ? 'Hide chat' : 'Chat'}</span>
          </Button>
        </div>
      </header>

      {/* Main layout: attendees + transcript grouped, optional chat on right */}
      <div
        className={`flex-1 min-h-0 grid gap-4 p-4 overflow-hidden ${
          showChat ? 'grid-cols-[minmax(0,2fr)_18rem]' : 'grid-cols-[minmax(0,2fr)]'
        }`}
      >
        {/* Grouped card: attendees (left) + transcript (right) with no gap between */}
        <div className="flex min-h-[260px] border border-border bg-card rounded-xl overflow-hidden">
          {/* Left: attendees list */}
          <div
            className={`flex flex-col border-r border-border ${
              showChat ? 'w-[80px]' : 'w-[260px]'
            }`}
          >
            <div className="p-3 border-b border-border flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Attendees</p>
                <p className="text-xs text-muted-foreground">
                  Select a customer to inspect their conversation.
                </p>
              </div>
              {attendees.length > 0 && !showChat && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {attendees.length} total
                </span>
              )}
            </div>
            <div className="flex-1 max-h-[calc(100vh-220px)] overflow-y-auto">
              {attendees.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  No attendees yet for this product.
                </div>
              ) : (
                <div className={showChat ? 'flex flex-col items-center gap-2 py-2' : 'divide-y divide-border'}>
                  {attendees.map((a) => {
                    const active = a.id === selectedAttendeeId

                    if (showChat) {
                      // Compact logo-only style when chat is visible
                      const base = (a.name || a.email || '?').trim()
                      const initials = base
                        .split(' ')
                        .filter(Boolean)
                        .map(part => part[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()

                      return (
                        <button
                          key={a.id}
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors ${
                            active
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                          onClick={() => setSelectedAttendeeId(a.id)}
                          title={base}
                        >
                          {initials}
                        </button>
                      )
                    }

                    // Full row style when chat is hidden
                    return (
                      <button
                        key={a.id}
                        className={`w-full text-left px-3 py-2.5 flex flex-col gap-0.5 transition-colors border-l-2 ${
                          active
                            ? 'bg-muted/60 border-primary'
                            : 'border-transparent hover:bg-muted/40'
                        }`}
                        onClick={() => setSelectedAttendeeId(a.id)}
                      >
                        <p className="text-sm font-medium truncate">{a.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {a.email}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Customer AI + user transcript, seamlessly attached */}
          <div className="flex-1 flex flex-col">
            <div className="p-3 border-b border-border flex items-center justify-between gap-2 bg-muted/60">
              <div>
                <p className="text-sm font-semibold">Customer AI + user transcript</p>
                <p className="text-xs text-muted-foreground">
                  Read-only view of what the customer and AI discussed.
                </p>
              </div>
              {selected && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground truncate max-w-[180px]">
                  {selected.name}
                </span>
              )}
            </div>
            <div className="flex-1 p-4 text-sm text-muted-foreground flex items-center justify-center">
              {selected ? (
                <div className="max-w-md text-center space-y-2">
                  <p className="text-foreground font-medium">Transcript UI coming soon</p>
                  <p className="text-xs text-muted-foreground">
                    We’ll show the full message history here – both what{' '}
                    <span className="font-semibold">{selected.name}</span> said and how your AI responded.
                  </p>
                </div>
              ) : (
                <div className="max-w-md text-center space-y-2">
                  <p className="text-foreground font-medium">
                    Select an attendee to inspect their conversation
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pick someone from the list on the left to prepare a transcript view for this product.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Far right: Stream chat, same structure as project, controlled by showChat */}
        {showChat && (
          <div className="h-full min-h-0">
            {chatLoading || !chatClient || !channel ? (
              <div className="w-full h-full bg-card border border-border rounded-xl overflow-hidden flex items-center justify-center text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading chat…
              </div>
            ) : (
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
            )}
          </div>
        )}
      </div>
    </div>
  )
}

