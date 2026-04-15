'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ParticipantView,
  StreamCall,
  StreamVideo,
  StreamVideoClient,
  useCallStateHooks,
  type Call,
} from '@stream-io/video-react-sdk'
import { Button } from '@/components/ui/button'
import { AlertCircle, Loader2, PhoneOff } from 'lucide-react'

type Props = {
  apiKey: string
  callId: string
  callType: string
  attendee: { id: string; name: string; image: string }
  token: string
  role: 'attendee' | 'host'
  onEnd: () => void
}

function ParticipantsGrid({ creatorJoinUrl }: { creatorJoinUrl: string | null }) {
  const { useParticipantCount, useParticipants } = useCallStateHooks()
  const participants = useParticipants()
  const participantCount = useParticipantCount()

  if (participants.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
          Waiting for the creator to join…
        </div>
        <div className="text-xs text-muted-foreground">Participants: {participantCount}</div>
        {creatorJoinUrl && (
          <a
            href={creatorJoinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
          >
            Creator join link
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 gap-2 p-2">
      {participants.map((p, idx) => (
        <ParticipantView
          // Participant objects are not stable across renders; index is acceptable for a 2-person call UI.
          key={idx}
          participant={p}
          className="w-full h-full object-cover !max-w-full"
        />
      ))}
    </div>
  )
}

export function StreamCallSession({
  apiKey,
  callId,
  callType,
  attendee,
  token,
  role,
  onEnd,
}: Props) {
  const [status, setStatus] = useState<'connecting' | 'error' | 'connected'>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  const clientRef = useRef<StreamVideoClient | null>(null)
  const callRef = useRef<Call | null>(null)

  const user = useMemo(() => {
    return { id: attendee.id, name: attendee.name, image: attendee.image }
  }, [attendee.id, attendee.image, attendee.name])

  const creatorJoinUrl = useMemo(() => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) return null
    return `${appUrl}/stream-calls/${encodeURIComponent(callId)}`
  }, [callId])

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      setStatus('connecting')
      setError(null)

      try {
        const streamClient = new StreamVideoClient({
          apiKey,
          user,
          token,
        })

        await streamClient.connectUser(user, token)

        const streamCall = streamClient.call(callType, callId)
        callRef.current = streamCall

        await streamCall.join({ create: false })

        if (role === 'host') {
          try {
            await streamCall.goLive()
          } catch {
            // best-effort
          }
        }

        if (cancelled) return

        clientRef.current = streamClient
        setStatus('connected')
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Failed to join call')
      }
    }

    void init()

    return () => {
      cancelled = true
      const c = clientRef.current
      const call = callRef.current

      callRef.current = null
      clientRef.current = null

      if (call) {
        void call.leave().catch(() => {})
      }
      if (c) {
        void c.disconnectUser().catch(() => {})
      }
    }
  }, [apiKey, callId, callType, role, token, user, retryKey])

  if (status === 'error') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive max-w-xs">{error}</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setRetryKey((k) => k + 1)}>
            Retry
          </Button>
          <Button variant="ghost" size="sm" onClick={onEnd}>
            <PhoneOff className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </div>
    )
  }

  if (status !== 'connected' || !clientRef.current || !callRef.current) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Connecting to the video call…</p>
        </div>
      </div>
    )
  }

  const client = clientRef.current
  const call = callRef.current
  if (!client || !call) return null

  return (
    <div className="w-full h-full relative">
      <StreamVideo client={client}>
        <StreamCall call={call}>
          <ParticipantsGrid creatorJoinUrl={role === 'attendee' ? creatorJoinUrl : null} />
        </StreamCall>
      </StreamVideo>

      <div className="absolute top-3 right-3">
        <Button variant="destructive" size="sm" onClick={onEnd} className="gap-1">
          <PhoneOff className="h-4 w-4" />
          Leave
        </Button>
      </div>
    </div>
  )
}

