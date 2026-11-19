'use client'

import 'stream-chat-react/dist/css/v2/index.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  hasVideo,
  ParticipantView,
  StreamCall,
  StreamVideo,
  StreamVideoClient,
  useCallStateHooks,
  type Call,
} from '@stream-io/video-react-sdk'
import { StreamChat, type Channel as ChatChannel, type Event as ChatEvent } from 'stream-chat'
import { Channel, Chat, MessageInput, MessageList } from 'stream-chat-react'
import { Loader2, Radio, Users, X } from 'lucide-react'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { HostControls } from './HostControls'
import { OfferDropDialog } from './OfferDropDialog'
import type { LiveSessionView } from './roomEvents'

type Props = {
  role: 'host' | 'viewer'
  apiKey: string
  token: string
  user: { id: string; name: string; image: string }
  hostUserId: string
  attendeeId: string | null
  session: LiveSessionView
}

const VIEWER_RETRY_MS = 5000

type Phase = 'connecting' | 'waiting-host' | 'ready' | 'ended' | 'failed'

export function LiveRoom({ role, apiKey, token, user, hostUserId, attendeeId, session }: Props) {
  const isHost = role === 'host'
  const [videoClient, setVideoClient] = useState<StreamVideoClient | null>(null)
  const [call, setCall] = useState<Call | null>(null)
  const [phase, setPhase] = useState<Phase>('connecting')
  const [failure, setFailure] = useState<string | null>(null)
  const [chatClient, setChatClient] = useState<StreamChat | null>(null)
  const [channel, setChannel] = useState<ChatChannel | null>(null)
  const [chatOpen, setChatOpen] = useState(true)
  const [offerOpen, setOfferOpen] = useState(false)
  const [live, setLive] = useState(session.isLive)
  const retryRef = useRef<() => void>(() => {})

  // Video: the host creates and owns the call; viewers join once the host has opened it.
  useEffect(() => {
    let cancelled = false
    let retryTimer = 0
    const client = new StreamVideoClient({ apiKey, user, token })
    const roomCall = client.call('livestream', session.id)

    const join = async () => {
      try {
        if (isHost) {
          await roomCall.join({ create: true })
          if (session.isLive) await roomCall.goLive()
        } else {
          await roomCall.join({ create: false })
        }
        if (cancelled) return
        setCall(roomCall)
        setPhase('ready')
      } catch (error) {
        if (cancelled) return
        if (!isHost) {
          // The host hasn't opened the studio yet: keep trying quietly.
          setPhase('waiting-host')
          retryTimer = window.setTimeout(() => void join(), VIEWER_RETRY_MS)
          return
        }
        setFailure(error instanceof Error ? error.message : 'Could not open the studio.')
        setPhase('failed')
      }
    }
    retryRef.current = () => {
      window.clearTimeout(retryTimer)
      void join()
    }

    setVideoClient(client)
    void join()
    const offEnded = roomCall.on('call.ended', () => {
      if (!isHost) setPhase('ended')
    })

    return () => {
      cancelled = true
      window.clearTimeout(retryTimer)
      offEnded()
      void roomCall
        .leave()
        .catch(() => {})
        .finally(() => void client.disconnectUser().catch(() => {}))
    }
  }, [apiKey, isHost, session.id, session.isLive, token, user])

  // Chat (and the room's control events) on the session's livestream channel.
  useEffect(() => {
    let cancelled = false
    const client = new StreamChat(apiKey)
    const connect = async () => {
      try {
        await client.connectUser({ id: user.id, name: user.name, image: user.image }, token)
        const roomChannel = client.channel('livestream', session.id, { name: session.title } as Record<string, unknown>)
        await roomChannel.watch()
        if (cancelled) return
        setChatClient(client)
        setChannel(roomChannel)
      } catch (error) {
        console.warn('[live-room] chat unavailable', error)
      }
    }
    void connect()
    return () => {
      cancelled = true
      void client.disconnectUser().catch(() => {})
    }
  }, [apiKey, session.id, session.title, token, user])

  useEffect(() => {
    if (!channel) return
    const subscription = channel.on((event: ChatEvent) => {
      const type = event.type as string
      if (isHost) return
      if (type === 'open_cta_dialog') setOfferOpen(true)
      if (type === 'start_live') {
        setLive(true)
        retryRef.current()
      }
      if (type === 'end_live') setPhase('ended')
    })
    return () => subscription.unsubscribe()
  }, [channel, isHost])

  const onHostEnded = useCallback(() => setPhase('ended'), [])

  if (phase === 'ended') {
    return (
      <RoomMessage
        title={isHost ? 'Session ended' : `${session.businessName} has ended the session`}
        detail={isHost ? 'Your viewers have been told the session is over.' : 'Thanks for joining.'}
        action={
          isHost
            ? { href: '/projects', label: 'Back to projects' }
            : session.sharePageHref
              ? { href: session.sharePageHref, label: 'See the offer' }
              : null
        }
      />
    )
  }

  if (phase === 'failed') {
    return (
      <RoomMessage
        title="Couldn't open the studio"
        detail={`${failure ?? ''} Allow camera and microphone access, then reload.`.trim()}
        action={{ href: `/live/${session.slug}/room`, label: 'Reload' }}
      />
    )
  }

  return (
    <div className="flex h-dvh flex-col bg-[#05060f] text-zinc-50">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
              live ? 'bg-rose-500/20 text-rose-300' : 'bg-white/10 text-zinc-300',
            )}
          >
            {live ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" /> : <Radio className="h-3 w-3" />}
            {live ? 'Live' : isHost ? 'Backstage' : 'Starting'}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{session.title}</p>
            <p className="truncate text-[11px] text-zinc-400">{session.businessName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setChatOpen((open) => !open)}
          aria-pressed={chatOpen}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs',
            chatOpen ? 'bg-white text-zinc-900' : 'border border-white/15 hover:bg-white/10',
          )}
        >
          Chat
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:flex-row">
        <section className="flex min-h-0 flex-1 flex-col gap-3">
          {videoClient && call ? (
            <StreamVideo client={videoClient}>
              <StreamCall call={call}>
                <Stage hostUserId={hostUserId} isHost={isHost} />
                {isHost ? (
                  <HostControls
                    call={call}
                    channel={channel}
                    session={session}
                    live={live}
                    onLive={() => setLive(true)}
                    onEnded={onHostEnded}
                    streamKey={token}
                    apiKey={apiKey}
                  />
                ) : null}
              </StreamCall>
            </StreamVideo>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] text-center">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-400" aria-hidden />
              <p className="text-sm text-zinc-300">
                {phase === 'waiting-host' ? `Waiting for ${session.businessName} to start…` : isHost ? 'Opening your studio…' : 'Joining…'}
              </p>
            </div>
          )}
        </section>

        {chatOpen ? (
          <aside className="flex h-[40dvh] shrink-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] md:h-auto md:w-80">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-sm font-medium">
              Live chat
              <button type="button" onClick={() => setChatOpen(false)} aria-label="Close chat" className="rounded-full p-1 text-zinc-400 hover:text-white md:hidden">
                <X className="h-4 w-4" />
              </button>
            </div>
            {chatClient && channel ? (
              <Chat client={chatClient} theme="str-chat__theme-dark">
                <Channel channel={channel}>
                  <div className="flex min-h-0 flex-1 flex-col [&_.str-chat]:bg-transparent [&_.str-chat__list]:bg-transparent">
                    <MessageList />
                    <MessageInput focus={false} />
                  </div>
                </Channel>
              </Chat>
            ) : (
              <p className="p-4 text-xs text-zinc-500">Connecting chat…</p>
            )}
          </aside>
        ) : null}
      </div>

      {!isHost && attendeeId ? (
        <OfferDropDialog
          open={offerOpen}
          onOpenChange={setOfferOpen}
          webinarId={session.id}
          attendeeId={attendeeId}
          title={session.title}
          description={session.description}
          acceptingPayments={session.acceptingPayments}
        />
      ) : null}
    </div>
  )
}

/** The video area: the host's feed and the live viewer count. */
function Stage({ hostUserId, isHost }: { hostUserId: string; isHost: boolean }) {
  const { useParticipants, useParticipantCount } = useCallStateHooks()
  const participants = useParticipants()
  const viewers = useParticipantCount()
  const host = participants.find((participant) => participant.userId === hostUserId) ?? null

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-3xl border border-white/10 bg-black">
      {host ? (
        <>
          {/* No default label or placeholder: the camera-off message below replaces them. */}
          <ParticipantView
            participant={host}
            ParticipantViewUI={null}
            VideoPlaceholder={null}
            className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-contain"
          />
          {!hasVideo(host) ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-center text-zinc-400">
              <Users className="h-10 w-10" aria-hidden />
              <p className="max-w-xs px-4 text-sm">
                {isHost
                  ? 'Your camera is off or blocked. Allow camera access in your browser, or stream from OBS.'
                  : `${host.name || 'The host'} has their camera off`}
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-500">
          <Users className="h-10 w-10" aria-hidden />
          <p className="text-sm">{isHost ? 'Turn your camera on to appear here' : 'The host will appear here'}</p>
        </div>
      )}
      <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs backdrop-blur">
        <Users className="h-3.5 w-3.5" aria-hidden />
        {Math.max(0, viewers - 1)} watching
      </span>
    </div>
  )
}

function RoomMessage({
  title,
  detail,
  action,
}: {
  title: string
  detail: string
  action: { href: string; label: string } | null
}) {
  useEffect(() => {
    toast.dismiss()
  }, [])
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#05060f] px-4 text-center text-zinc-50">
      <div className="max-w-sm space-y-3">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-zinc-400">{detail}</p>
        {action ? (
          <Link href={action.href} className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200">
            {action.label}
          </Link>
        ) : null}
      </div>
    </main>
  )
}
