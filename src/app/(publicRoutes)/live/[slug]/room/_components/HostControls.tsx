'use client'

import { useEffect, useRef, useState } from 'react'
import { useCallStateHooks, type Call } from '@stream-io/video-react-sdk'
import type { Channel as ChatChannel } from 'stream-chat'
import { Copy, Loader2, Mic, MicOff, Radio, Settings2, ShoppingBag, Square, Video, VideoOff } from 'lucide-react'
import { toast } from 'sonner'
import { changeProjectStatus } from '@/actions/webiner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { sendRoomEvent, type LiveSessionView } from './roomEvents'

type Props = {
  call: Call
  channel: ChatChannel | null
  session: LiveSessionView
  live: boolean
  onLive: () => void
  onEnded: () => void
  /** The host's token doubles as the OBS stream key. */
  streamKey: string
  apiKey: string
}

const BUTTON = 'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm transition-colors disabled:opacity-50'

/** The presenter's studio bar: mic/camera, go live, drop the offer, OBS settings and end. */
export function HostControls({ call, channel, session, live, onLive, onEnded, streamKey, apiKey }: Props) {
  const { useCameraState, useMicrophoneState } = useCallStateHooks()
  const { camera, isMute: cameraOff } = useCameraState()
  const { microphone, isMute: micOff } = useMicrophoneState()
  const [busy, setBusy] = useState<'live' | 'end' | 'offer' | null>(null)
  const [obsOpen, setObsOpen] = useState(false)
  const recordingRef = useRef(false)

  // Record the session once an OBS (RTMP) broadcast starts.
  useEffect(() => {
    const offStarted = call.on('call.recording_started', () => {
      recordingRef.current = true
    })
    const offBroadcast = call.on('call.rtmp_broadcast_started', () => {
      if (recordingRef.current) return
      call.startRecording().then(
        () => {
          recordingRef.current = true
        },
        (error: unknown) => {
          const message = error instanceof Error ? error.message : ''
          if (!message.includes('already being recorded')) toast.error('Could not start recording')
        },
      )
    })
    return () => {
      offStarted()
      offBroadcast()
    }
  }, [call])

  const goLive = async () => {
    setBusy('live')
    try {
      await call.goLive()
      const result = await changeProjectStatus(session.id, 'LIVE')
      if (!result.success) throw new Error(result.message)
      if (channel) await sendRoomEvent(channel, 'start_live')
      onLive()
      toast.success('You are live. Your waiting room is letting people in.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not go live')
    } finally {
      setBusy(null)
    }
  }

  const dropOffer = async () => {
    if (!channel) return toast.error('Chat is still connecting')
    setBusy('offer')
    try {
      await sendRoomEvent(channel, 'open_cta_dialog')
      toast.success('Offer sent to everyone watching')
    } catch {
      toast.error('Could not send the offer')
    } finally {
      setBusy(null)
    }
  }

  const endSession = async () => {
    setBusy('end')
    try {
      if (channel) await sendRoomEvent(channel, 'end_live').catch(() => {})
      await call.stopLive({ continue_recording: false }).catch(() => {})
      await call.endCall().catch(() => {})
      const result = await changeProjectStatus(session.id, 'ENDED')
      if (!result.success) throw new Error(result.message)
      onEnded()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not end the session')
    } finally {
      setBusy(null)
    }
  }

  const rtmpUrl = `rtmps://ingress.stream-io-video.com:443/${apiKey}.livestream.${session.id}`
  const copy = (label: string, value: string) =>
    navigator.clipboard.writeText(value).then(
      () => toast.success(`${label} copied`),
      () => toast.error('Could not copy'),
    )

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-3xl border border-white/10 bg-white/[0.03] p-2">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => void microphone.toggle()}
          aria-label={micOff ? 'Unmute microphone' : 'Mute microphone'}
          className={cn(BUTTON, micOff ? 'bg-rose-500/20 text-rose-300' : 'border border-white/15 hover:bg-white/10')}
        >
          {micOff ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => void camera.toggle()}
          aria-label={cameraOff ? 'Turn camera on' : 'Turn camera off'}
          className={cn(BUTTON, cameraOff ? 'bg-rose-500/20 text-rose-300' : 'border border-white/15 hover:bg-white/10')}
        >
          {cameraOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
        </button>
        <button type="button" onClick={() => setObsOpen(true)} className={cn(BUTTON, 'border border-white/15 hover:bg-white/10')}>
          <Settings2 className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">OBS</span>
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        {live ? (
          <button type="button" onClick={() => void dropOffer()} disabled={busy !== null} className={cn(BUTTON, 'bg-violet-500 text-white hover:bg-violet-400')}>
            {busy === 'offer' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" aria-hidden />}
            Drop offer
          </button>
        ) : (
          <button type="button" onClick={() => void goLive()} disabled={busy !== null} className={cn(BUTTON, 'bg-rose-500 font-medium text-white hover:bg-rose-400')}>
            {busy === 'live' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" aria-hidden />}
            Go live
          </button>
        )}
        <button type="button" onClick={() => void endSession()} disabled={busy !== null} className={cn(BUTTON, 'border border-white/15 hover:bg-white/10')}>
          {busy === 'end' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" aria-hidden />}
          End
        </button>
      </div>

      <Dialog open={obsOpen} onOpenChange={setObsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Stream from OBS</DialogTitle>
            <DialogDescription>Paste these into OBS → Settings → Stream (Service: Custom). Keep the key private.</DialogDescription>
          </DialogHeader>
          {[
            { label: 'Server URL', value: rtmpUrl },
            { label: 'Stream key', value: streamKey },
          ].map((item) => (
            <div key={item.label} className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
              <div className="flex gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-xs">{item.value}</code>
                <button
                  type="button"
                  onClick={() => void copy(item.label, item.value)}
                  aria-label={`Copy ${item.label}`}
                  className="rounded-lg border border-border px-2.5 hover:bg-muted"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </div>
  )
}
