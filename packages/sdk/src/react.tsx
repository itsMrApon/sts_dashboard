import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createSts, type StsClient } from './core.js'
import { createWizardPlayer, type WizardPlayer } from './wizardPlayer.js'
import {
  StsError,
  type StsBusiness,
  type StsChatLinks,
  type StsForm,
  type StsSessionInfo,
  type StsWizard,
  type StsWizardStep,
} from './types.js'

const StsContext = createContext<StsClient | null>(null)

/** Wrap your site once. Every hook below talks to your STS-AI business through this client. */
export function StsProvider({ apiBase, siteKey, children }: { apiBase: string; siteKey: string; children: ReactNode }) {
  const client = useMemo(() => createSts({ apiBase, siteKey }), [apiBase, siteKey])
  return <StsContext.Provider value={client}>{children}</StsContext.Provider>
}

export function useSts(): StsClient {
  const client = useContext(StsContext)
  if (!client) throw new Error('Wrap your app in <StsProvider apiBase siteKey>')
  return client
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong'
}

/** Business name + which services are turned on. */
export function useStsInfo() {
  const client = useSts()
  const [info, setInfo] = useState<StsSessionInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    client
      .info()
      .then((value) => active && setInfo(value))
      .catch((err) => active && setError(errorMessage(err)))
    return () => {
      active = false
    }
  }, [client])
  return { info, error }
}

// ── Chat AI ────────────────────────────────────────────────────────────────

export type StsChatMessage = { id: string; role: 'user' | 'assistant'; content: string; links?: StsChatLinks }

export function useStsChat() {
  const client = useSts()
  const { info, error: infoError } = useStsInfo()
  const [messages, setMessages] = useState<StsChatMessage[]>([])
  const [status, setStatus] = useState<'idle' | 'thinking' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const counter = useRef(0)
  const nextId = () => `m${(counter.current += 1)}`

  const send = useCallback(
    async (text: string) => {
      const message = text.trim()
      if (!message || status === 'thinking') return
      setMessages((current) => [...current, { id: nextId(), role: 'user', content: message }])
      setStatus('thinking')
      setError(null)
      try {
        const result = await client.chat.send(message)
        setMessages((current) => [...current, { id: nextId(), role: 'assistant', content: result.reply, links: result.links }])
        setStatus('idle')
      } catch (err) {
        setError(errorMessage(err))
        setStatus('error')
      }
    },
    [client, status],
  )

  const chat = info?.services.chat ?? null
  return {
    /** false when Chat AI is off in the dashboard. */
    available: Boolean(chat),
    greeting: chat?.greeting ?? '',
    suggestions: chat?.suggestions ?? [],
    maxMessageLength: chat?.maxMessageLength ?? 1000,
    messages,
    send,
    reset: () => setMessages([]),
    status,
    error: error ?? infoError,
  }
}

// ── Speak AI ───────────────────────────────────────────────────────────────

type SpeakState = 'idle' | 'connecting' | 'live' | 'ended' | 'error'

/** Voice call over WebRTC. Requires `livekit-client` installed on your site. */
export function useStsSpeak() {
  const client = useSts()
  const [state, setState] = useState<SpeakState>('idle')
  const [isAgentSpeaking, setAgentSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const roomRef = useRef<{ disconnect: () => Promise<void> } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioEls = useRef<HTMLMediaElement[]>([])

  const stop = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    const room = roomRef.current
    roomRef.current = null
    audioEls.current.forEach((el) => el.remove())
    audioEls.current = []
    setAgentSpeaking(false)
    if (room) await room.disconnect()
    setState((current) => (current === 'error' ? current : 'ended'))
  }, [])

  const start = useCallback(
    async (participantName?: string) => {
      if (roomRef.current) return
      setState('connecting')
      setError(null)
      try {
        const [{ Room, RoomEvent, Track }, details] = await Promise.all([
          import('livekit-client'),
          client.speak.connect(participantName),
        ])
        const room = new Room()
        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind !== Track.Kind.Audio) return
          const element = track.attach()
          element.style.display = 'none'
          document.body.appendChild(element)
          audioEls.current.push(element)
        })
        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          setAgentSpeaking(speakers.some((speaker) => speaker.identity !== room.localParticipant.identity))
        })
        room.on(RoomEvent.Disconnected, () => void stop())
        await room.connect(details.serverUrl, details.participantToken)
        await room.localParticipant.setMicrophoneEnabled(true)
        roomRef.current = room
        setState('live')
        timerRef.current = setTimeout(() => void stop(), details.maxCallMinutes * 60_000)
      } catch (err) {
        setError(errorMessage(err))
        setState('error')
        await stop()
      }
    },
    [client, stop],
  )

  useEffect(() => () => void stop(), [stop])

  return { state, start, stop, isAgentSpeaking, error }
}

// ── Form ───────────────────────────────────────────────────────────────────

export function useStsForm() {
  const client = useSts()
  const [form, setForm] = useState<StsForm | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'submitting' | 'success' | 'error' | 'unavailable'>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    client.form
      .schema()
      .then((schema) => {
        if (!active) return
        setForm(schema)
        setStatus('ready')
      })
      .catch((err) => {
        if (!active) return
        setStatus(err instanceof StsError && err.code === 'SERVICE_DISABLED' ? 'unavailable' : 'error')
        setMessage(errorMessage(err))
      })
    return () => {
      active = false
    }
  }, [client])

  const setValue = useCallback((fieldId: string, value: string) => {
    setValues((current) => ({ ...current, [fieldId]: value }))
  }, [])

  const submit = useCallback(async () => {
    setStatus('submitting')
    setFieldError(null)
    try {
      setMessage(await client.form.submit(values, consent))
      setStatus('success')
      setValues({})
      setConsent(false)
    } catch (err) {
      setMessage(errorMessage(err))
      setFieldError(err instanceof StsError ? err.fieldId : null)
      setStatus('error')
    }
  }, [client, consent, values])

  return { form, values, setValue, consent, setConsent, submit, status, message, fieldError }
}

// ── Wizard ─────────────────────────────────────────────────────────────────

/**
 * Voice tour across your own page. Tag sections with `data-sts-step="…"`; style `[data-sts-active]`.
 * Each business has one wizard, so `slug` is optional.
 */
export function useStsWizard(slug?: string) {
  const client = useSts()
  const [wizard, setWizard] = useState<StsWizard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [step, setStep] = useState<StsWizardStep | null>(null)
  const [stepIndex, setStepIndex] = useState(-1)
  const [muted, setMutedState] = useState(false)
  const playerRef = useRef<WizardPlayer | null>(null)

  useEffect(() => {
    let active = true
    const resolveSlug = slug
      ? Promise.resolve(slug)
      : client.info().then((info) => {
          const first = info.services.wizards[0]?.slug
          if (!first) throw new Error('No published wizard for this business')
          return first
        })
    resolveSlug
      .then((wizardSlug) => client.wizard.load(wizardSlug))
      .then((value) => active && setWizard(value))
      .catch((err) => active && setError(errorMessage(err)))
    return () => {
      active = false
      playerRef.current?.stop()
    }
  }, [client, slug])

  const start = useCallback(() => {
    if (!wizard) return
    playerRef.current?.stop()
    const player = createWizardPlayer(wizard, {
      onStep: (current, index) => {
        setStep(current)
        setStepIndex(index)
      },
      onSpeakingChange: setSpeaking,
      onEnd: () => setPlaying(false),
    })
    player.setMuted(muted)
    playerRef.current = player
    setPlaying(true)
    player.start()
  }, [muted, wizard])

  const stop = useCallback(() => {
    playerRef.current?.stop()
    setPlaying(false)
  }, [])

  const setMuted = useCallback((value: boolean) => {
    setMutedState(value)
    playerRef.current?.setMuted(value)
  }, [])

  return {
    wizard,
    ready: Boolean(wizard),
    start,
    stop,
    playing,
    speaking,
    step,
    stepIndex,
    caption: step?.narration ?? '',
    muted,
    setMuted,
    error,
  }
}

// ── Business details ───────────────────────────────────────────────────────

export function useStsBusiness() {
  const client = useSts()
  const [business, setBusiness] = useState<StsBusiness | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    client.business
      .get()
      .then((value) => active && setBusiness(value))
      .catch((err) => active && setError(errorMessage(err)))
    return () => {
      active = false
    }
  }, [client])
  return { business, error }
}

export type { StsChatLinks, StsForm, StsSessionInfo, StsWizard, StsWizardStep, StsBusiness }
