'use client'

/**
 * LiveKit voice session for Speak (moved from the old 3-tab chat room). One mounted session =
 * one call; a fresh LiveKit room per call (`<room>-v<n>`) keeps agent dispatch reliable.
 */
import { useEffect, useMemo, useRef } from 'react'
import { RoomEvent, TokenSource } from 'livekit-client'
import {
  RoomAudioRenderer,
  SessionProvider,
  StartAudio,
  useAgent,
  useSession,
  useVoiceAssistant,
} from '@livekit/components-react'
import { fetchLiveKitConnectionDetails } from '@/lib/livekit/livekitClient'
import { getFirstPartySessionToken } from '@/lib/embed/firstPartySessionClient'

/** One toast line for mic / getUserMedia / LiveKit track permission issues (avoid raw DOMException text). */
export const MIC_ACCESS_TOAST =
  'Microphone access was blocked or unavailable. Allow access in your browser and try again.'
export const VOICE_AGENT_UNAVAILABLE_TOAST =
  'Voice agent is temporarily unavailable. Please try again in a moment.'

/** Cap wait for previous `session.end()` so a stuck promise cannot block the next call forever. */
export const VOICE_TEARDOWN_MAX_MS = 12_000
/** Agent join + first reply can exceed 18s when VAD/config are cold. */
export const VOICE_AGENT_WATCHDOG_MS = 45_000

function isLikelyMediaPermissionFailure(error: unknown): boolean {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') return true
  }
  const msg = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase()
  return (
    msg.includes('not allowed by the user agent') ||
    msg.includes('permission denied') ||
    msg.includes('user denied') ||
    msg.includes('notallowederror')
  )
}

function toastMessageForVoiceSessionFailure(error: unknown): string {
  if (isLikelyMediaPermissionFailure(error)) return MIC_ACCESS_TOAST
  const msg = error instanceof Error ? error.message : String(error ?? 'Failed to connect')
  return msg.length > 140 ? 'Could not start voice. Try again.' : msg
}

export type VoiceUIPhase = 'idle' | 'listening' | 'talking'

function VoicePhaseSync({
  isConnected,
  onPhase,
}: {
  isConnected: boolean
  onPhase: (phase: VoiceUIPhase) => void
}) {
  const { state } = useVoiceAssistant()

  useEffect(() => {
    if (!isConnected) {
      onPhase('idle')
      return
    }
    if (state === 'listening') onPhase('listening')
    else if (state === 'speaking') onPhase('talking')
    else onPhase('idle')
  }, [isConnected, state, onPhase])

  return null
}

export function VoiceSession({
  roomName,
  onError,
  autoStart,
  onVoicePhase,
  sessionKey,
  onFullyDisconnected,
}: {
  /** Chat / business id from the URL (unchanged). */
  roomName: string
  onError: (message: string | null) => void
  autoStart: boolean
  onVoicePhase: (phase: VoiceUIPhase) => void
  /** Bumps each new call so we abort any in-flight `start()` and run a fresh connect. */
  sessionKey: number
  /** Fires after `session.end()` resolves — parent must await this before the next call. */
  onFullyDisconnected: () => void
}) {
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  const onFullyDisconnectedRef = useRef(onFullyDisconnected)
  onFullyDisconnectedRef.current = onFullyDisconnected

  /** Unique LiveKit room per call — reusing the same room name after disconnect often leaves Cloud
   *  / agent dispatch in a bad state; the second join gets no agent or a stuck job. */
  const liveKitRoomName = useMemo(
    () => `${roomName}-v${sessionKey}`,
    [roomName, sessionKey],
  )

  const participantName = useMemo(
    () => `web-user-${sessionKey}-${Math.random().toString(36).slice(2, 6)}`,
    [sessionKey],
  )

  const tokenSource = useMemo(
    () =>
      TokenSource.custom(async () => {
        const details = await fetchLiveKitConnectionDetails({
          roomName: liveKitRoomName,
          participantName,
          assistantId: 'saas-agent',
          sessionToken: await getFirstPartySessionToken(roomName),
        })
        return details
      }),
    [liveKitRoomName, participantName, roomName],
  )

  const session = useSession(tokenSource, {
    roomName: liveKitRoomName,
    // Cold job process + SaaS agent-config can exceed the library default (20s).
    agentConnectTimeoutMilliseconds: 45_000,
  })
  const agent = useAgent(session)
  const sessionRef = useRef(session)
  sessionRef.current = session

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAgentFailureToastRef = useRef<string | null>(null)
  const isBenignStartError = (error: unknown) => {
    const msg = error instanceof Error ? error.message : String(error ?? '')
    const m = msg.toLowerCase()
    return m.includes('client initiated disconnect')
  }

  useEffect(() => {
    const room = session.room
    const onMediaDevicesError = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      onErrorRef.current(MIC_ACCESS_TOAST)
    }
    room.on(RoomEvent.MediaDevicesError, onMediaDevicesError)
    return () => {
      room.off(RoomEvent.MediaDevicesError, onMediaDevicesError)
    }
  }, [session.room])

  useEffect(() => {
    if (agent.state !== 'failed') {
      lastAgentFailureToastRef.current = null
      return
    }

    const reasons =
      Array.isArray((agent as { failureReasons?: unknown }).failureReasons) &&
      (agent as { failureReasons: unknown[] }).failureReasons.length > 0
        ? ((agent as { failureReasons: unknown[] }).failureReasons
            .filter((v): v is string => typeof v === 'string')
            .join(' ')
            .trim() || VOICE_AGENT_UNAVAILABLE_TOAST)
        : VOICE_AGENT_UNAVAILABLE_TOAST

    const msg = reasons.toLowerCase().includes('unexpectedly')
      ? `${VOICE_AGENT_UNAVAILABLE_TOAST} (backend provider may be over quota).`
      : reasons

    if (lastAgentFailureToastRef.current === msg) return
    lastAgentFailureToastRef.current = msg
    onErrorRef.current(msg)
  }, [agent])

  useEffect(() => {
    if (!autoStart) return

    onErrorRef.current(null)

    timeoutRef.current = setTimeout(() => {
      if (!sessionRef.current?.isConnected) {
        onErrorRef.current('Voice connection timed out. Please try again.')
      }
    }, 12000)

    // Do not pass AbortSignal / abort() on unmount — that can leave the Room in a bad state
    // and break the next session.start(). session.end() tears down the in-flight connect.
    void Promise.resolve(sessionRef.current.start()).catch((err: unknown) => {
      if (isBenignStartError(err)) return
      onErrorRef.current(toastMessageForVoiceSessionFailure(err))
    })

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      void Promise.resolve(sessionRef.current?.end())
        .catch((err: unknown) => {
          if (isBenignStartError(err)) return
          console.error('[voice-session:end]', err)
        })
        .finally(() => {
          onFullyDisconnectedRef.current()
        })
    }
  }, [autoStart, sessionKey])

  return (
    <SessionProvider session={session}>
      {session.isConnected && <RoomAudioRenderer />}
      <StartAudio
        key={`voice-start-audio-${sessionKey}`}
        label="Enable voice audio"
        className="sr-only"
      />
      <VoicePhaseSync isConnected={session.isConnected} onPhase={onVoicePhase} />
    </SessionProvider>
  )
}
