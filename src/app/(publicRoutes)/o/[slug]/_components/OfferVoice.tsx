'use client'

import React, { useState } from 'react'
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
    <div className="flex flex-col items-center gap-4 rounded-xl border border-border p-5">
      <span
        className={cn(
          'flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary transition-transform',
          state === 'speaking' && 'scale-110 animate-pulse',
        )}
        aria-hidden="true"
      >
        <Mic className="h-7 w-7" />
      </span>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {STATE_LABEL[state] ?? 'Connecting…'}
      </p>
      {!active ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" /> : null}
      <Button
        variant="outline"
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

/** Voice call with the offer's AI, right on the share page. */
export function OfferVoice({ slug, onOrderRequested }: { slug: string; onOrderRequested: () => void }) {
  const [connection, setConnection] = useState<ConnectionDetails | null>(null)
  const [starting, setStarting] = useState(false)

  const start = async () => {
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

  if (!connection) {
    return (
      <Button variant="outline" className="w-full" onClick={start} disabled={starting}>
        {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mic className="mr-2 h-4 w-4" />}
        Start voice call
      </Button>
    )
  }

  return (
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
  )
}
