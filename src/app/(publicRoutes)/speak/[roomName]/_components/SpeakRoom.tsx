'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Mic, Phone, PhoneOff, Users } from 'lucide-react'
import { toast } from 'sonner'
import { WizardGem } from '@/components/wizard/WizardGem'
import type { SpeakServiceConfig } from '@/lib/services/types'
import { cn } from '@/lib/utils'
import { humanRowsFromSocial, openMessagingTarget, type SocialAccountInput } from '../_lib/humanContacts'
import {
  MIC_ACCESS_TOAST,
  VOICE_AGENT_UNAVAILABLE_TOAST,
  VOICE_AGENT_WATCHDOG_MS,
  VOICE_TEARDOWN_MAX_MS,
  VoiceSession,
  type VoiceUIPhase,
} from './VoiceSession'

type Props = {
  roomName: string
  agentName: string
  businessName: string
  firstMessage: string
  /** Speak AI settings: call limit and warning, orb look, button label, "A person" contacts. */
  config: SpeakServiceConfig
  socialAccounts: SocialAccountInput[]
  /** Compact layout for the dashboard Home preview. */
  embedded?: boolean
}

const PHASES: { phase: VoiceUIPhase; label: string }[] = [
  { phase: 'idle', label: 'Idle' },
  { phase: 'listening', label: 'Listening' },
  { phase: 'talking', label: 'Talking' },
]

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/** Speak service: a voice call with the business AI, plus "talk to a person" contacts. */
export function SpeakRoom({
  roomName,
  agentName,
  businessName,
  firstMessage,
  config,
  socialAccounts,
  embedded = false,
}: Props) {
  const { maxCallMinutes, endWarningSeconds } = config
  const [active, setActive] = useState(false)
  const [phase, setPhase] = useState<VoiceUIPhase>('idle')
  const [callKey, setCallKey] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [peopleOpen, setPeopleOpen] = useState(false)
  const phaseRef = useRef<VoiceUIPhase>('idle')
  phaseRef.current = phase
  const watchdogShownForRef = useRef(-1)

  /** The next call waits for the previous session's teardown before it mounts. */
  const disconnectWaitRef = useRef<Promise<void>>(Promise.resolve())
  const pendingResolveRef = useRef<(() => void) | null>(null)

  const people = useMemo(
    () => (config.showHumanHandoff ? humanRowsFromSocial(socialAccounts) : []),
    [config.showHumanHandoff, socialAccounts],
  )
  const limitSeconds = Math.max(1, maxCallMinutes) * 60

  const onSessionError = useCallback((message: string | null) => {
    if (message) toast.error(message)
  }, [])

  const onFullyDisconnected = useCallback(() => {
    pendingResolveRef.current?.()
    pendingResolveRef.current = null
  }, [])

  const endCall = useCallback(() => setActive(false), [])

  const startCall = useCallback(async () => {
    if (active) return
    try {
      await Promise.race([
        disconnectWaitRef.current,
        new Promise<void>((resolve) => setTimeout(resolve, VOICE_TEARDOWN_MAX_MS)),
      ])
      disconnectWaitRef.current = new Promise<void>((resolve) => {
        pendingResolveRef.current = resolve
      })
      setPeopleOpen(false)
      // Ask for the mic up front so a blocked mic fails here with a clear message.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      setElapsed(0)
      setCallKey((key) => key + 1)
      setActive(true)
    } catch {
      toast.error(MIC_ACCESS_TOAST)
      pendingResolveRef.current?.()
      pendingResolveRef.current = null
      disconnectWaitRef.current = Promise.resolve()
    }
  }, [active])

  useEffect(() => {
    if (!active) setPhase('idle')
  }, [active])

  // Call clock + the Speak service's max call length.
  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000)
    return () => window.clearInterval(timer)
  }, [active])

  // Heads-up before the limit, so the caller can wrap up.
  useEffect(() => {
    if (!active || !endWarningSeconds || limitSeconds <= endWarningSeconds) return
    if (elapsed === limitSeconds - endWarningSeconds) {
      toast.info(`${endWarningSeconds} seconds left on this call.`)
    }
  }, [active, elapsed, endWarningSeconds, limitSeconds])

  useEffect(() => {
    if (!active || elapsed < limitSeconds) return
    setActive(false)
    toast.info(`Calls are limited to ${maxCallMinutes} minute${maxCallMinutes === 1 ? '' : 's'}.`)
  }, [active, elapsed, limitSeconds, maxCallMinutes])

  // If the agent never speaks or listens, tell the caller instead of leaving silence.
  useEffect(() => {
    if (!active || phase !== 'idle' || watchdogShownForRef.current === callKey) return
    const timer = window.setTimeout(() => {
      if (phaseRef.current !== 'idle') return
      watchdogShownForRef.current = callKey
      toast.error(VOICE_AGENT_UNAVAILABLE_TOAST)
    }, VOICE_AGENT_WATCHDOG_MS)
    return () => window.clearTimeout(timer)
  }, [active, phase, callKey])

  const status = !active
    ? 'Tap the mic to start a call'
    : phase === 'talking'
      ? `${agentName} is talking`
      : phase === 'listening'
        ? 'Listening…'
        : 'Connecting…'

  return (
    <div
      className={cn(
        'relative flex flex-col items-center overflow-hidden text-center text-zinc-50',
        embedded
          ? 'h-full justify-center gap-4 rounded-3xl bg-[#05060f] p-5'
          : 'gap-6 rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-8 shadow-2xl shadow-black/40 backdrop-blur',
      )}
    >
      <WizardGem theme={config.orbTheme} shape={config.orbShape} size={embedded ? 150 : 220} speaking={active && phase === 'talking'} />

      <div className="space-y-1.5">
        <p className="text-sm font-medium">{agentName}</p>
        <p className="mx-auto max-w-sm text-sm text-zinc-300">{active ? status : firstMessage}</p>
      </div>

      <div className="grid w-full max-w-[280px] grid-cols-3 gap-1.5 text-[11px] font-medium" role="status" aria-live="polite">
        {PHASES.map((item) => (
          <span
            key={item.phase}
            className={cn(
              'rounded-full px-2 py-1 transition-colors',
              active && phase === item.phase ? 'bg-white text-zinc-900' : 'bg-white/[0.06] text-zinc-400',
            )}
          >
            {item.label}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={active ? endCall : () => void startCall()}
            aria-label={active ? 'End call' : 'Start call'}
            className={cn(
              'flex h-16 w-16 items-center justify-center rounded-full transition-transform active:scale-95',
              active ? 'bg-rose-500 text-white hover:bg-rose-400' : 'bg-white text-zinc-900 hover:bg-zinc-200',
            )}
          >
            {active ? <PhoneOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </button>
          <span className="text-xs tabular-nums text-zinc-400">
            {active ? `${formatClock(elapsed)} / ${maxCallMinutes}:00` : config.callButtonLabel}
          </span>
        </div>
        {people.length > 0 ? (
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPeopleOpen(true)}
              disabled={active}
              aria-label="Talk to a person"
              className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 text-zinc-100 hover:bg-white/10 disabled:opacity-40"
            >
              <Users className="h-6 w-6" />
            </button>
            <span className="text-xs text-zinc-400">A person</span>
          </div>
        ) : null}
      </div>

      {active ? (
        <VoiceSession
          key={callKey}
          roomName={roomName}
          onError={onSessionError}
          autoStart={active}
          onVoicePhase={setPhase}
          sessionKey={callKey}
          onFullyDisconnected={onFullyDisconnected}
        />
      ) : null}

      {peopleOpen ? (
        <div
          className="absolute inset-0 z-10 flex flex-col gap-3 bg-[#05060f] p-5 text-left"
          role="dialog"
          aria-modal="true"
          aria-labelledby="speak-people-title"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPeopleOpen(false)}
              aria-label="Back"
              className="rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <p id="speak-people-title" className="text-sm font-semibold">
                Talk to {businessName}
              </p>
              <p className="text-[11px] text-zinc-400">Message or call the team directly</p>
            </div>
          </div>
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {people.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <button type="button" onClick={() => openMessagingTarget(row.web, row.appScheme)} className="min-w-0 text-left">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{row.displayKind}</span>
                  <span className="block truncate text-sm font-medium">{row.label}</span>
                </button>
                {row.telHref ? (
                  <a
                    href={row.telHref}
                    aria-label={`Call ${row.label}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-400"
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
