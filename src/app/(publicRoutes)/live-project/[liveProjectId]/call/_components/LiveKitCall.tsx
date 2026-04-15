'use client'

import { changeCallStatus } from '@/actions/attendance'
import { createCheckoutLink } from '@/actions/stripe'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { WebinarWithPresenter } from '@/lib/type'
import { cn } from '@/lib/utils'
import { fetchLiveKitConnectionDetails } from '@/lib/livekit/livekitClient'
import { CallStatusEnum } from '@prisma/client'
import { TokenSource } from 'livekit-client'
import { Track } from 'livekit-client'
import {
  RoomAudioRenderer,
  SessionProvider,
  StartAudio,
  useSession,
  useTrackToggle,
  useVoiceAssistant,
} from '@livekit/components-react'
import { Bot, Clock, Loader2, Mic, MicOff, PhoneOff } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

const CallStatus = {
  CONNECTING: 'CONNECTING',
  ACTIVE: 'ACTIVE',
  FINISHED: 'FINISHED',
}

type Props = {
  roomName: string
  userName: string
  assistantName: string
  callTimeLimit: number
  project: WebinarWithPresenter
  userId: string
  /** When true, hide the Buy Now button (e.g. product page has its own). */
  hideBuyNow?: boolean
  /** Optional callback when the call has fully ended (for parent UIs). */
  onCallEnd?: () => void
}

function LiveKitCallInner({
  session,
  userName,
  assistantName,
  callTimeLimit,
  project,
  userId,
  hideBuyNow,
  onCallEnd,
}: Omit<Props, 'roomName'> & {
  session: { room?: { on: (e: string, cb: () => void) => void; off: (e: string, cb: () => void) => void }; end: () => void; isConnected: boolean }
}) {
  const { state } = useVoiceAssistant()
  const { enabled: micEnabled, toggle: toggleMic } = useTrackToggle({
    source: Track.Source.Microphone,
    initialState: false, // Start muted to avoid publish before engine ready
  })

  const [callStatus, setCallStatus] = useState(CallStatus.CONNECTING)
  const [timeRemaining, setTimeRemaining] = useState(callTimeLimit)
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const hadActiveCallRef = useRef(false)

  const assistantIsSpeaking = state === 'speaking'

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const stopCall = useCallback(async () => {
    try {
      session.end()
      setCallStatus(CallStatus.FINISHED)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = undefined
      }
      // Only mark COMPLETED if the call was actually active (user had a real conversation).
      // If we disconnected during "Connecting...", leave PENDING so they can retry.
      if (hadActiveCallRef.current) {
        const res = await changeCallStatus(userId, CallStatusEnum.COMPLETED)
        if (!res.success) throw new Error('Failed to update call status')
        toast.success('Call ended successfully')
      } else {
        toast.info('Connection ended. You can try again.')
      }
      onCallEnd?.()
    } catch (error) {
      console.error('Error stopping call:', error)
      toast.error('Failed to stop call, please try again.')
    }
  }, [session, userId, onCallEnd])

  const safeToggleMic = () => {
    try {
      toggleMic(!micEnabled)
    } catch (error) {
      const err = error as { message?: string } | undefined
      const msg = err?.message ?? ''
      // Swallow LiveKit engine timing errors and show a friendly message instead of crashing.
      if (typeof msg === 'string' && msg.toLowerCase().includes('engine not connected')) {
        toast.error('AI is still connecting. Please wait a moment and try again.')
        return
      }
      console.error('Mic toggle error:', error)
      toast.error('Could not toggle microphone. Please try again.')
    }
  }

  useEffect(() => {
    if (session.isConnected && callStatus === CallStatus.CONNECTING) {
      hadActiveCallRef.current = true
      setCallStatus(CallStatus.ACTIVE)
      changeCallStatus(userId, CallStatusEnum.InProgress)
      setTimeRemaining(callTimeLimit)
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current)
            stopCall()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = undefined
      }
    }
  }, [session.isConnected, callStatus, callTimeLimit, userId, stopCall])

  useEffect(() => {
    const room = session.room
    if (!room) return
    const handleDisconnect = () => {
      if (callStatus !== CallStatus.FINISHED) {
        stopCall()
      }
    }
    room.on('disconnected', handleDisconnect)
    return () => {
      room.off('disconnected', handleDisconnect)
    }
  }, [session.room, stopCall, callStatus])

  const checkoutLink = async () => {
    try {
      if (!project?.priceId || !project?.presenter?.stripeConnectId) {
        return toast.error('No priceId or stripeConnectId found')
      }
      const sessionRes = await createCheckoutLink(
        project.priceId,
        project.presenter.stripeConnectId,
        userId,
        project.id,
      )
      if (!sessionRes.sessionUrl) throw new Error('Session ID not found')
      window.open(sessionRes.sessionUrl, '_blank')
    } catch (error) {
      console.error('Error creating checkout link:', error)
      toast.error('Failed to create checkout link')
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-background">
      <div className="flex-1 flex flex-col md:flex-row p-4 gap-4 relative">
        <div className="flex-1 bg-card rounded-xl overflow-hidden shadow-lg relative">
          <div className="absolute top-4 left-4 bg-black/40 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2 z-10">
            <Mic
              className={cn(
                'h-4 w-4',
                assistantIsSpeaking ? 'text-accent-primary' : '',
              )}
            />
            <span>{assistantName}</span>
          </div>
          <div className="h-full flex items-center justify-center">
            <div className="relative">
              {assistantIsSpeaking && (
                <>
                  <div
                    className="absolute inset-0 rounded-full border-4 border-accent-primary animate-ping opacity-20"
                    style={{ margin: '-8px' }}
                  />
                  <div
                    className="absolute inset-0 rounded-full border-4 border-accent-primary animate-ping opacity-10"
                    style={{ margin: '-16px', animationDelay: '0.5s' }}
                  />
                </>
              )}
              <div
                className={cn(
                  'flex justify-center items-center rounded-full overflow-hidden border-4 p-6',
                  assistantIsSpeaking
                    ? 'border-accent-primary'
                    : 'border-accent-secondary/50',
                )}
              >
                <Bot className="w-[70px] h-[70px]" />
              </div>
              {assistantIsSpeaking && (
                <div className="absolute -bottom-2 -right-2 bg-accent-primary text-white p-2 rounded-full">
                  <Mic className="w-5 h-5" />
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex-1 bg-card rounded-xl overflow-hidden shadow-lg relative">
          <div className="absolute top-4 left-4 bg-black/40 rounded-full text-sm flex items-center gap-2 z-10">
            {!micEnabled ? (
              <>
                <MicOff className="h-4 w-4 text-destructive" />
                <span>Muted</span>
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" />
                <span>{userName}</span>
              </>
            )}
          </div>
          <div className="absolute top-4 right-4 bg-black/40 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2 z-10">
            <Clock className="h-4 w-4" />
            <span>{formatTime(timeRemaining)}</span>
          </div>
          <div className="h-full flex items-center justify-center">
            <div className="relative">
              <div
                className={cn(
                  'flex justify-center items-center rounded-full overflow-hidden border-4',
                  !micEnabled
                    ? 'border-destructive/50'
                    : 'border-accent-secondary/50',
                )}
              >
                <Avatar className="w-[100px] h-[100px]">
                  <AvatarImage src="/user-avatar.png" alt={userName} />
                  <AvatarFallback>{userName.split(' ')?.[0]}</AvatarFallback>
                </Avatar>
              </div>
              {!micEnabled && (
                <div className="absolute -bottom-2 -right-2 bg-destructive text-white p-2 rounded-full">
                  <MicOff className="w-5 h-5" />
                </div>
              )}
            </div>
          </div>
          {callStatus === CallStatus.CONNECTING && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center flex-col gap-4 z-20">
              <Loader2 className="h-10 w-10 text-accent-primary animate-spin" />
              <h3 className="text-xl font-medium">Connecting...</h3>
            </div>
          )}
          {callStatus === CallStatus.FINISHED && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center flex-col gap-4 z-20">
              <h3 className="text-2xl font-bold">Call ended</h3>
              <p className="text-muted-foreground">This session has finished.</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-card border-t border-border p-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            {callStatus === CallStatus.ACTIVE && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span
                  className={cn(
                    'text-sm font-medium',
                    timeRemaining < 30
                      ? 'text-destructive animate-pulse'
                      : timeRemaining < 60
                        ? 'text-amber-500'
                        : 'text-muted-foreground',
                  )}
                >
                  {formatTime(timeRemaining)} remaining
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <StartAudio label="Allow audio" className="text-sm" />
            <button
              onClick={safeToggleMic}
              className={cn(
                'p-3 rounded-full transition-all',
                !micEnabled
                  ? 'bg-destructive text-primary'
                  : 'bg-secondary text-foreground hover:bg-secondary/80',
              )}
              disabled={callStatus !== CallStatus.ACTIVE}
            >
              {!micEnabled ? (
                <MicOff className="h-6 w-6" />
              ) : (
                <Mic className="h-6 w-6" />
              )}
            </button>
            <button
              onClick={stopCall}
              className="p-3 rounded-full bg-destructive text-primary hover:bg-destructive/90 transition-all"
              aria-label="End call"
              disabled={callStatus !== CallStatus.ACTIVE}
            >
              <PhoneOff className="h-6 w-6" />
            </button>
          </div>
          {!hideBuyNow && (
            <Button onClick={checkoutLink} variant="outline">
              Buy Now
            </Button>
          )}
          <div className="hidden md:block">
            {callStatus === CallStatus.ACTIVE && timeRemaining < 30 && (
              <span className="text-destructive font-medium">Call ending soon</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LiveKitCall(props: Props) {
  const { roomName, userName, onCallEnd } = props
  const [callEnded, setCallEnded] = useState(false)
  const hadConnectedRef = useRef(false)

  const tokenSource = useMemo(
    () =>
      TokenSource.custom(async () => {
        const details = await fetchLiveKitConnectionDetails({
          roomName,
          participantName: userName,
        })
        return details
      }),
    [roomName, userName],
  )

  const session = useSession(tokenSource, { roomName })
  const sessionRef = useRef(session)
  sessionRef.current = session

  useEffect(() => {
    if (session.isConnected) hadConnectedRef.current = true
  }, [session.isConnected])

  useEffect(() => {
    const room = session.room
    if (!room) return
    const handleDisconnected = () => {
      if (hadConnectedRef.current) {
        setCallEnded(true)
        onCallEnd?.()
      }
    }
    room.on('disconnected', handleDisconnected)
    return () => {
      room.off('disconnected', handleDisconnected)
    }
  }, [session.room])

  useEffect(() => {
    const s = sessionRef.current
    s.start()
    return () => {
      sessionRef.current?.end()
    }
  }, []) // Run once on mount; session ref avoids reconnect loops from changing session identity

  return (
    <SessionProvider session={session}>
      {session.isConnected && <RoomAudioRenderer />}
      {callEnded ? (
        <div className="flex flex-col h-[calc(100vh-80px)] bg-background items-center justify-center gap-4">
          <h3 className="text-xl font-medium">Call ended</h3>
          <p className="text-muted-foreground text-sm">You can close this page or start a new call.</p>
        </div>
      ) : !session.isConnected ? (
        <div className="flex flex-col h-[calc(100vh-80px)] bg-background items-center justify-center gap-4">
          <Loader2 className="h-10 w-10 text-accent-primary animate-spin" />
          <h3 className="text-xl font-medium">Connecting...</h3>
        </div>
      ) : (
        <LiveKitCallInner {...props} session={session as { room?: { on: (e: string, cb: () => void) => void; off: (e: string, cb: () => void) => void }; end: () => void; isConnected: boolean }} />
      )}
    </SessionProvider>
  )
}
