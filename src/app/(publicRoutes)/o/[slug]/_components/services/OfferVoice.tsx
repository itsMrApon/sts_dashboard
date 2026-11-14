'use client'

import React, { useImperativeHandle, useRef, useState, type Ref } from 'react'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useDataChannel,
  useRoomContext,
  useVoiceAssistant,
} from '@livekit/components-react'
import { Loader2, Mic, PhoneOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { startOfferVoice } from '@/actions/buyer'
import type { ConnectionDetails } from '@/lib/livekit/livekitVoiceAgent'

/** Must match OFFER_TOPIC in agents/python/livekit-agent/agent/main.py. */
const OFFER_TOPIC = 'sts.offer'

const STATE_LABEL: Record<string, string> = {
  disconnected: 'Connecting…',
  connecting: 'Connecting…',
  initializing: 'The assistant is joining…',
  listening: 'Listening — go ahead',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
}

function Orb({ active, pulsing }: { active: boolean; pulsing: boolean }) {
  return (
    <span className="relative flex h-32 w-32 items-center justify-center" aria-hidden="true">
      <span
        className={cn(
          'absolute inset-0 rounded-full bg-primary/20 blur-xl transition-opacity',
          active ? 'opacity-100' : 'opacity-40',
          pulsing && 'animate-pulse',
        )}
      />
      <span
        className={cn(
          'relative flex h-24 w-24 items-center justify-center rounded-full border border-primary/40 bg-primary/15 text-primary transition-transform duration-300',
          pulsing && 'scale-110',
        )}
      >
        <Mic className="h-9 w-9" />
      </span>
    </span>
  )
}

function ActiveCall({ onOrderRequested, onEnd }: { onOrderRequested: () => void; onEnd: () => void }) {
  const room = useRoomContext()
  const { state } = useVoiceAssistant()

  // The agent's show_order_button tool publishes { type: "show_order" } on this topic.
  useDataChannel(OFFER_TOPIC, (message) => {
    try {
      const payload = JSON.parse(new TextDecoder().decode(message.payload)) as { type?: string }
      if (payload.type === 'show_order') onOrderRequested()
    } catch {
      // Ignore malformed messages.
    }
  })

  const active = state === 'speaking' || state === 'listening' || state === 'thinking'
  return (
    <div className="flex flex-col items-center gap-5">
      <Orb active={active} pulsing={state === 'speaking'} />
      <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
        {!active ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {STATE_LABEL[state] ?? 'Connecting…'}
      </p>
      <Button
        variant="outline"
        className="rounded-full"
        onClick={() => {
          void room.disconnect()
          onEnd()
        }}
      >
        <PhoneOff className="mr-2 h-4 w-4" /> End call
      </Button>
    </div>
  )
}

export type OfferVoiceControl = { start: () => void; stop: () => void }

/** Voice call with the offer's AI. Fills its panel in the AI room; tapping the mic starts the call. */
export function OfferVoice({
  slug,
  businessName,
  onOrderRequested,
  controlRef,
  onStart,
}: {
  slug: string
  businessName: string
  onOrderRequested: () => void
  /** Lets the page start or end the call from its own buttons (the Voice tab). */
  controlRef?: Ref<OfferVoiceControl>
  /** Called when a call starts, so the page can stop other audio (the tour). */
  onStart?: () => void
}) {
  const [connection, setConnection] = useState<ConnectionDetails | null>(null)
  const [starting, setStarting] = useState(false)
  const busyRef = useRef(false)
  busyRef.current = starting || !!connection

  const start = async () => {
    if (busyRef.current) return
    busyRef.current = true
    onStart?.()
    setStarting(true)
    try {
      const result = await startOfferVoice({ slug })
      if (!result.ok) return void toast.error(result.error)
      setConnection(result.connection)
    } catch {
      toast.error('Could not start the call')
    } finally {
      setStarting(false)
    }
  }

  useImperativeHandle(controlRef, () => ({ start: () => void start(), stop: () => setConnection(null) }))

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 p-6 text-center">
      {connection ? (
        <LiveKitRoom
          serverUrl={connection.serverUrl}
          token={connection.participantToken}
          connect
          audio
          video={false}
          onDisconnected={() => setConnection(null)}
          onMediaDeviceFailure={() => toast.error('Allow microphone access to talk to the assistant')}
        >
          <RoomAudioRenderer />
          <ActiveCall onOrderRequested={onOrderRequested} onEnd={() => setConnection(null)} />
        </LiveKitRoom>
      ) : (
        <>
          <button
            type="button"
            onClick={() => void start()}
            disabled={starting}
            aria-label={`Talk to ${businessName}`}
            className="rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait"
          >
            <Orb active={starting} pulsing={starting} />
          </button>
          <div className="space-y-1">
            <p className="font-medium">{starting ? 'Connecting…' : `Tap to talk to ${businessName}`}</p>
            <p className="text-sm text-muted-foreground">Ask out loud. The AI answers in a natural voice.</p>
          </div>
          {starting ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" /> : null}
        </>
      )}
    </div>
  )
}
