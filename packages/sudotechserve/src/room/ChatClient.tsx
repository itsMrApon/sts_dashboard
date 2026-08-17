'use client'

import { useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import {
  Send,
  AudioLines,
  PhoneOff,
  PhoneCall,
  Phone,
  Users,
  ChevronsUpDown,
} from 'lucide-react'
import { Card, CardContent, CardFooter } from '../ui/card'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command'
import { Conversation, ConversationContent } from '../ui/conversation'
import { Message, MessageAvatar, MessageContent } from '../ui/message'
import { TokenSource, RoomEvent } from 'livekit-client'
import {
  RoomAudioRenderer,
  SessionProvider,
  StartAudio,
  useAgent,
  useSession,
  useVoiceAssistant,
} from '@livekit/components-react'
import { SORTED_ISO2, countryLabel, dialForIso2 } from '../lib/phoneCountryCodes'
import { cn } from '../lib/utils'
import { toast } from 'sonner'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import type { AgentState } from '../ui/orb'
import type { StsAiClient } from '../client'

const Orb = lazy(() => import('../ui/orb').then((mod) => ({ default: mod.Orb })))

const ORB_FALLBACK = (
  <div
    className="h-full w-full rounded-full bg-gradient-to-br from-primary/25 via-muted/40 to-primary/15 animate-pulse"
    aria-hidden
  />
)

/** Standalone `/chat/[room]` and home embed use the same frame (matches home preview). */
const CHAT_CARD_FRAME =
  'relative flex flex-col gap-2 overflow-hidden rounded-[28px] border-0 bg-background text-foreground shadow-none backdrop-blur-none pb-2 pt-0'

/** One toast line for mic / getUserMedia / LiveKit track permission issues (avoid raw DOMException text). */
const MIC_ACCESS_TOAST =
  'Microphone access was blocked or unavailable. Allow access in your browser and try again.'
const VOICE_AGENT_UNAVAILABLE_TOAST =
  'Voice agent is temporarily unavailable. Please try again in a moment.'

/** Cap wait for previous `session.end()` so a stuck promise cannot block the next call forever. */
const VOICE_TEARDOWN_MAX_MS = 12_000
/** Agent join + first reply can exceed 18s when VAD/config are cold. */
const VOICE_AGENT_WATCHDOG_MS = 45_000

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

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  roomJoinLink?: string | null
  buyNowLink?: string | null
}

type Props = {
  roomName: string
  agentName: string
  businessName: string
  firstMessage: string
  socialAccounts: { platform: string; label: string; url?: string }[]
  /** STS-AI embed API client (site key + CORS). */
  embedClient: StsAiClient
  /** Compact card layout (same as `?embed=1`) — use when embedding on e.g. Home. */
  embedMode?: boolean
  /** Initial tab when the widget mounts (`?tab=` in URL still overrides on load). */
  defaultTab?: 'chat' | 'voice' | 'mobile'
}

type ContactPlatform = 'WHATSAPP' | 'TELEGRAM' | 'MESSENGER' | 'WECHAT'

type HumanContactRow = {
  id: string
  displayKind: 'WhatsApp' | 'Messenger' | 'Telegram' | 'WeChat'
  label: string
  web: string
  appScheme: string | null
  /** `tel:` link when the label or chat URL implies a phone number. */
  telHref: string | null
  keywords: string[]
}

function dialTelFromLabel(label: string): string | null {
  const digits = label.replace(/\D/g, '')
  if (digits.length < 8) return null
  return `tel:+${digits}`
}

function dialTelFromWaMeUrl(web: string): string | null {
  const m = web.match(/wa\.me\/(\d{8,})/i)
  if (!m) return null
  return `tel:+${m[1]}`
}

function countryFlagEmoji(iso2: string): string {
  const cc = iso2.toUpperCase()
  if (cc.length !== 2 || !/^[A-Z]{2}$/.test(cc)) return ''
  return String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0)))
}

function normalizeUrl(value?: string): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  return `https://${trimmed}`
}

function buildWeChatLink(account?: { label: string; url?: string }): string | null {
  const rawUrl = normalizeUrl(account?.url)
  if (rawUrl) return rawUrl
  const label = (account?.label || '').trim()
  if (!label) return null
  if (label.startsWith('http://') || label.startsWith('https://')) return normalizeUrl(label)
  return null
}

function buildContactLink(platform: ContactPlatform, account?: { label: string; url?: string }): string | null {
  if (platform === 'WECHAT') {
    return buildWeChatLink(account)
  }

  const rawUrl = normalizeUrl(account?.url)
  if (rawUrl) return rawUrl

  const label = (account?.label || '').trim()
  if (!label) return null

  if (platform === 'WHATSAPP') {
    const phone = label.replace(/[^\d+]/g, '')
    if (!phone) return null
    return `https://wa.me/${phone.replace('+', '')}`
  }

  if (platform === 'TELEGRAM') {
    const username = label.replace(/^@/, '')
    return username ? `https://t.me/${username}` : null
  }

  const pageId = label.replace(/^@/, '')
  return pageId ? `https://m.me/${pageId}` : null
}

/**
 * Prefer opening the native app on mobile via custom scheme (does not navigate this page).
 * If the tab stays visible, fall back to the HTTPS link (opens chat / call entry in browser or app).
 */
function openMessagingTarget(webUrl: string, appScheme: string | null) {
  if (typeof window === 'undefined' || !webUrl) return
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
  if (appScheme && mobile) {
    const a = document.createElement('a')
    a.href = appScheme
    a.rel = 'noopener noreferrer'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => {
      if (document.visibilityState === 'visible') {
        window.open(webUrl, '_blank', 'noopener,noreferrer')
      }
    }, 800)
    return
  }
  window.open(webUrl, '_blank', 'noopener,noreferrer')
}

function humanRowsFromSocial(
  accounts: { platform: string; label: string; url?: string }[],
): HumanContactRow[] {
  const rows: HumanContactRow[] = []
  let n = 0

  for (const s of accounts) {
    const pl = (s.label || '').trim()
    const hasUrl = Boolean((s.url || '').trim())
    if (!pl && !hasUrl) continue

    if (s.platform === 'WHATSAPP') {
      const web = buildContactLink('WHATSAPP', s)
      if (!web) continue
      const digits = pl.replace(/\D/g, '')
      const appScheme =
        digits.length >= 8 ? `whatsapp://send?phone=${digits.replace(/^\+/, '')}` : null
      const telHref = dialTelFromLabel(pl) || dialTelFromWaMeUrl(web)
      rows.push({
        id: `wa-${n++}`,
        displayKind: 'WhatsApp',
        label: pl || 'WhatsApp',
        web,
        appScheme,
        telHref,
        keywords: [pl, 'whatsapp', 'wa', digits, web, 'dial', 'call', telHref || ''].filter(
          Boolean,
        ),
      })
      continue
    }

    if (
      s.platform === 'FACEBOOK_DM' ||
      s.platform === 'FACEBOOK_MESSENGER' ||
      s.platform === 'MESSENGER'
    ) {
      const web = buildContactLink('MESSENGER', s)
      if (!web) continue
      const telHref = dialTelFromLabel(pl)
      rows.push({
        id: `ms-${n++}`,
        displayKind: 'Messenger',
        label: pl || 'Messenger',
        web,
        appScheme: null,
        telHref,
        keywords: [pl, 'messenger', 'facebook', 'fb', web, 'dial', 'call', telHref || ''].filter(
          Boolean,
        ),
      })
      continue
    }

    if (s.platform === 'TELEGRAM') {
      const web = buildContactLink('TELEGRAM', s)
      if (!web) continue
      const username = pl.replace(/^@/, '').replace(/.*t\.me\//i, '').split('/')[0] || pl
      const appScheme = username ? `tg://resolve?domain=${encodeURIComponent(username)}` : null
      const telHref = dialTelFromLabel(pl)
      rows.push({
        id: `tg-${n++}`,
        displayKind: 'Telegram',
        label: pl || 'Telegram',
        web,
        appScheme,
        telHref,
        keywords: [pl, username, 'telegram', 'tg', web, 'dial', 'call', telHref || ''].filter(
          Boolean,
        ),
      })
      continue
    }

    if (s.platform === 'WECHAT') {
      const web = buildContactLink('WECHAT', s)
      if (!web) continue
      const telHref = dialTelFromLabel(pl)
      rows.push({
        id: `wx-${n++}`,
        displayKind: 'WeChat',
        label: pl || 'WeChat',
        web,
        appScheme: null,
        telHref,
        keywords: [pl, 'wechat', 'weixin', '微信', web, 'dial', 'call', telHref || ''].filter(
          Boolean,
        ),
      })
    }
  }

  const order: Record<HumanContactRow['displayKind'], number> = {
    WhatsApp: 0,
    Messenger: 1,
    Telegram: 2,
    WeChat: 3,
  }
  rows.sort((a, b) => order[a.displayKind] - order[b.displayKind])
  return rows
}

type VoiceUIPhase = 'idle' | 'listening' | 'talking'

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

function VoiceSession({
  roomName,
  embedClient,
  onError,
  autoStart,
  onVoicePhase,
  sessionKey,
  onFullyDisconnected,
}: {
  /** Chat / business id from the URL (unchanged). */
  roomName: string
  embedClient: StsAiClient
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
        const details = await embedClient.getLiveKitConnectionDetails({
          roomName: liveKitRoomName,
          participantName,
          assistantId: 'saas-agent',
        })
        return details
      }),
    [embedClient, liveKitRoomName, participantName],
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

export const ChatClient = ({
  roomName,
  agentName,
  businessName,
  firstMessage,
  socialAccounts,
  embedClient,
  embedMode = false,
  defaultTab,
}: Props) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: firstMessage },
  ])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'thinking' | 'error'>('idle')
  const [sessionId] = useState(() => {
    const key = `chat-session-${roomName}`
    try {
      const existing = localStorage.getItem(key)
      if (existing) return existing
    } catch {
      // ignore
    }
    const v = Math.random().toString(36).slice(2)
    try {
      localStorage.setItem(key, v)
    } catch {
      // ignore
    }
    return v
  })
  const [tab, setTab] = useState<'chat' | 'voice' | 'mobile'>(defaultTab ?? 'voice')
  const [isEmbed, setIsEmbed] = useState(!!embedMode)
  const [voiceActive, setVoiceActive] = useState(false)
  const [callHumenOpen, setCallHumenOpen] = useState(false)
  const [voicePhase, setVoicePhase] = useState<VoiceUIPhase>('idle')
  const [voiceStartKey, setVoiceStartKey] = useState(0)
  const [showContactPopup, setShowContactPopup] = useState(false)
  const [mobileName, setMobileName] = useState('John')
  const [countryIso, setCountryIso] = useState('US')
  const [countryPickerOpen, setCountryPickerOpen] = useState(false)
  const [consent, setConsent] = useState(false)
  const [mobilePhone, setMobilePhone] = useState('')
  const [mobileMessage, setMobileMessage] = useState('')
  const [mobileSaved, setMobileSaved] = useState(false)
  const [mobileSubmitting, setMobileSubmitting] = useState(false)
  const [mobileError, setMobileError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const voiceQuotaToastShownForKeyRef = useRef<number>(-1)
  const voicePhaseRef = useRef<VoiceUIPhase>('idle')

  const whatsapp = useMemo(
    () => socialAccounts.find((s) => s.platform === 'WHATSAPP'),
    [socialAccounts],
  )
  const telegram = useMemo(
    () => socialAccounts.find((s) => s.platform === 'TELEGRAM'),
    [socialAccounts],
  )
  const messenger = useMemo(
    () =>
      socialAccounts.find(
        (s) =>
          s.platform === 'FACEBOOK' ||
          s.platform === 'FACEBOOK_MESSENGER' ||
          s.platform === 'FACEBOOK_DM' ||
          s.platform === 'MESSENGER',
      ),
    [socialAccounts],
  )
  const wechat = useMemo(
    () => socialAccounts.find((s) => s.platform === 'WECHAT'),
    [socialAccounts],
  )

  const humanContactRows = useMemo(
    () => humanRowsFromSocial(socialAccounts),
    [socialAccounts],
  )

  const onVoiceSessionError = useCallback((msg: string | null) => {
    if (msg) toast.error(msg)
  }, [])

  /** Next `startAiVoiceCall` awaits this so the previous `room.disconnect()` finishes before a new session mounts. */
  const voiceDisconnectWaitRef = useRef<Promise<void>>(Promise.resolve())
  const voicePendingResolveRef = useRef<(() => void) | null>(null)

  const onVoiceSessionFullyDisconnected = useCallback(() => {
    voicePendingResolveRef.current?.()
    voicePendingResolveRef.current = null
  }, [])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || status === 'thinking') return

      setMessages((prev) => [...prev, { role: 'user', content: text }])
      setInput('')
      setStatus('thinking')

      try {
        const data = await embedClient.sendChat(text, sessionId)

        if (data.error) {
          const errorCode = typeof data.code === 'string' ? data.code : null
          const errText =
            typeof data.error === 'string'
              ? data.error
              : 'Request failed'
          const assistantFallback =
            errorCode === 'NO_API_KEY'
              ? 'I cannot answer yet because Gemini key is missing. Add it in Config Agent.'
              : errorCode === 'INVALID_API_KEY'
                ? 'I cannot answer because Gemini key is invalid. Please update it in Config Agent.'
                : errorCode === 'QUOTA_EXCEEDED'
                  ? 'Gemini quota is currently exceeded. Please retry later or upgrade billing.'
                  : errorCode === 'MODEL_ERROR'
                    ? 'This model is unavailable for your key. Pick another model in agent settings.'
                    : 'I could not generate a reply right now. Please try again.'
          toast.error(errText)
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: assistantFallback,
            },
          ])
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: data.reply,
              roomJoinLink: data.roomJoinLink,
              buyNowLink: data.buyNowLink,
            },
          ])
        }
        setStatus('idle')
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Connection lost. Please try again.' },
        ])
        setStatus('error')
      }
    },
    [embedClient, sessionId, status],
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  useEffect(() => {
    if (!voiceActive) inputRef.current?.focus()
  }, [voiceActive])

  useEffect(() => {
    if (!voiceActive) setVoicePhase('idle')
  }, [voiceActive])

  useEffect(() => {
    voicePhaseRef.current = voicePhase
  }, [voicePhase])

  useEffect(() => {
    if (!voiceActive) return
    if (voicePhase === 'listening' || voicePhase === 'talking') return
    if (voiceQuotaToastShownForKeyRef.current === voiceStartKey) return

    const timer = window.setTimeout(() => {
      if (!voiceActive) return
      if (voicePhaseRef.current === 'listening' || voicePhaseRef.current === 'talking') return
      voiceQuotaToastShownForKeyRef.current = voiceStartKey
      toast.error(VOICE_AGENT_UNAVAILABLE_TOAST)
    }, VOICE_AGENT_WATCHDOG_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [voiceActive, voicePhase, voiceStartKey])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const embed = params.get('embed')
    setIsEmbed((prev) => prev || embed === '1' || embed === 'true')
    const requestedTab = params.get('tab')
    if (requestedTab === 'chat' || requestedTab === 'voice' || requestedTab === 'mobile') {
      setTab(requestedTab)
    }
  }, [])

  const handleContactRedirect = useCallback((platform: ContactPlatform) => {
    const account =
      platform === 'WHATSAPP'
        ? whatsapp
        : platform === 'TELEGRAM'
          ? telegram
          : platform === 'WECHAT'
            ? wechat
            : messenger
    const url = buildContactLink(platform, account)
    if (!url) return
    window.open(url, '_blank', 'noopener,noreferrer')
    setShowContactPopup(false)
  }, [whatsapp, telegram, messenger, wechat])

  const orbAgentState: AgentState = useMemo(() => {
    if (!voiceActive) return null
    if (voicePhase === 'listening') return 'listening'
    if (voicePhase === 'talking') return 'talking'
    return null
  }, [voiceActive, voicePhase])

  const startAiVoiceCall = useCallback(async () => {
    if (voiceActive) return
    try {
      await Promise.race([
        voiceDisconnectWaitRef.current,
        new Promise<void>((r) => setTimeout(r, VOICE_TEARDOWN_MAX_MS)),
      ])

      voiceDisconnectWaitRef.current = new Promise<void>((resolve) => {
        voicePendingResolveRef.current = resolve
      })

      setCallHumenOpen(false)

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())

      setVoiceStartKey((k) => k + 1)
      setVoiceActive(true)
    } catch {
      // Do not log the DOMException — Next devtools treats console.error(Error) as a surfaced "Console Error"
      toast.error(MIC_ACCESS_TOAST)
      voicePendingResolveRef.current?.()
      voicePendingResolveRef.current = null
      voiceDisconnectWaitRef.current = Promise.resolve()
    }
  }, [voiceActive])

  const submitMobileCallback = useCallback(async () => {
    if (!mobilePhone.trim() || !consent || mobileSubmitting) return

    setMobileSubmitting(true)
    setMobileError(null)
    setMobileSaved(false)

    try {
      const data = await embedClient.submitMobileCallback({
        name: mobileName.trim() || 'Anonymous',
        countryCode: dialForIso2(countryIso),
        phone: mobilePhone.trim(),
        note: mobileMessage.trim(),
        consent,
      })

      if (!data.ok) {
        setMobileError(data.error || 'Failed to submit callback request.')
        return
      }

      setMobileSaved(true)
    } catch {
      setMobileError('Network error while submitting callback request.')
    } finally {
      setMobileSubmitting(false)
    }
  }, [consent, countryIso, embedClient, mobileMessage, mobileName, mobilePhone, mobileSubmitting])

  return (
    <div
      className={`relative flex overflow-hidden bg-background text-foreground ${
        embedMode
          ? 'h-full min-h-0 items-center justify-center p-0'
          : isEmbed
            ? 'min-h-screen items-end justify-end p-2 sm:p-4'
            : 'min-h-screen items-center justify-center p-4'
      }`}
    >
      <Card
        className={cn(
          CHAT_CARD_FRAME,
          embedMode ? 'z-0 h-full w-full' : 'z-10 h-[490px] w-full max-w-[430px]',
        )}
      >
        <div className="flex justify-center px-3 pb-2 pt-2">
          <div className="inline-flex rounded-full border-0 bg-background p-1 text-[16px]">
            {(['chat', 'voice', 'mobile'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setTab(item)
                  setVoiceActive(false)
                  setCallHumenOpen(false)
                }}
                className={`rounded-full px-7 py-1.5 capitalize transition-all ${
                  tab === item
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <CardContent className="min-h-0 flex-1 overflow-y-auto p-2.5">
          {tab === 'chat' ? (
            <Conversation className="h-full rounded-[28px] border-0 bg-background">
              <ConversationContent className="flex flex-col gap-0.5 p-4">
                {messages.map((msg, i) => (
                  <Message key={i} from={msg.role}>
                    {msg.role === 'assistant' ? (
                      <MessageAvatar from="assistant" name={agentName} />
                    ) : null}
                    <MessageContent variant="flat">
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      {msg.role === 'assistant' && (msg.buyNowLink || msg.roomJoinLink) && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {msg.buyNowLink && (
                            <a
                              href={msg.buyNowLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
                            >
                              Buy Now →
                            </a>
                          )}
                          {msg.roomJoinLink && (
                            <a
                              href={msg.roomJoinLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                            >
                              Join Room →
                            </a>
                          )}
                        </div>
                      )}
                    </MessageContent>
                    {msg.role === 'user' ? (
                      <MessageAvatar from="user" name="You" />
                    ) : null}
                  </Message>
                ))}

                {status === 'thinking' && (
                  <Message from="assistant">
                    <MessageAvatar from="assistant" name={agentName} />
                    <MessageContent variant="flat">
                      <div className="flex items-center gap-1 py-0.5" aria-hidden>
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
                      </div>
                    </MessageContent>
                  </Message>
                )}
              </ConversationContent>
            </Conversation>
          ) : tab === 'voice' ? (
            <div className="relative flex h-full min-h-0 flex-col rounded-[24px] border-0 bg-background px-5 py-4">
              {/* Orb + session: centered in remaining space so status chips are not pushed into the footer/clipped */}
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 py-2">
                <div
                  className="relative mx-auto shrink-0 overflow-hidden rounded-full"
                  style={{ width: 208, height: 208 }}
                >
                  <Suspense fallback={ORB_FALLBACK}>
                    <Orb
                      key={`voice-orb-${roomName}`}
                      agentState={orbAgentState}
                      colors={['#79b8ff', '#9ddfca']}
                      resizeDebounce={0}
                      className="h-full w-full"
                    />
                  </Suspense>
                </div>
                {voiceActive && (
                  <VoiceSession
                    key={voiceStartKey}
                    roomName={roomName}
                    embedClient={embedClient}
                    onError={onVoiceSessionError}
                    autoStart={voiceActive}
                    onVoicePhase={setVoicePhase}
                    sessionKey={voiceStartKey}
                    onFullyDisconnected={onVoiceSessionFullyDisconnected}
                  />
                )}
              </div>
              <div className="shrink-0 px-0 pb-1 pt-2" role="status" aria-live="polite">
                <div className="mx-auto grid w-full max-w-[280px] grid-cols-3 gap-2 text-center text-[11px] font-medium leading-normal sm:text-xs">
                  {(
                    [
                      { phase: 'idle' as const, label: 'Idle' },
                      { phase: 'listening' as const, label: 'Listening' },
                      { phase: 'talking' as const, label: 'Talking' },
                    ] as const
                  ).map(({ phase, label }) => (
                    <span
                      key={phase}
                      className={cn(
                        'rounded-lg px-1.5 py-1.5 transition-colors sm:px-2',
                        voicePhase === phase
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-muted/60 text-muted-foreground',
                      )}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Call Humen: overlay only — does not resize or move the orb stack */}
              {!voiceActive && callHumenOpen && (
                <div
                  className="absolute inset-0 z-10 flex flex-col gap-3 rounded-[24px] border-0 bg-background p-4 shadow-none"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="call-humen-title"
                >
                  <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border pb-3">
                    <div>
                      <p id="call-humen-title" className="text-base font-semibold text-foreground">
                        Call {businessName}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Numbers and apps from business profile
                      </p>
                    </div>
                  </div>
                  <Command className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
                    <CommandInput placeholder="Search socal" />
                    <CommandList className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                      <CommandEmpty className="px-3 py-4 text-center text-xs text-muted-foreground">
                        No social accounts attached to this call.
                      </CommandEmpty>
                      <CommandGroup heading>
                        {humanContactRows.map((row) => (
                          <CommandItem
                            key={row.id}
                            value={`${row.displayKind} ${row.label} ${row.keywords.join(' ')}`}
                            keywords={row.keywords}
                            onSelect={() => openMessagingTarget(row.web, row.appScheme)}
                            className="flex cursor-pointer flex-col items-start gap-0.5 py-2.5 aria-selected:bg-accent"
                          >
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {row.displayKind}
                            </span>
                            <span className="text-sm font-medium text-foreground">{row.label}</span>
                            <span className="text-[11px] text-muted-foreground">
                              Tap row to open in app / browser
                            </span>
                            {row.telHref ? (
                              <a
                                href={row.telHref}
                                className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15"
                                onClick={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                              >
                                <Phone className="h-3.5 w-3.5" aria-hidden />
                                Dial number
                              </a>
                            ) : null}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col gap-4 overflow-y-auto rounded-[24px] border-0 bg-background p-5 shadow-none">
              <h3 className="text-3xl leading-tight font-semibold tracking-tight text-foreground">Receive a live call from an Humen Agent</h3>
              <p className="text-base leading-relaxed text-muted-foreground">
                Leave the details below to have the Humen Agent call you directly on your mobile phone.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input value={mobileName} onChange={(e) => setMobileName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone number</label>
                <div className="grid grid-cols-[minmax(11rem,1fr)_minmax(0,1.5fr)] gap-2">
                  <Popover open={countryPickerOpen} onOpenChange={setCountryPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={countryPickerOpen}
                        className="h-11 w-full justify-between rounded-xl border-border bg-muted/40 px-2.5 font-normal hover:bg-muted/50"
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left">
                          <span className="shrink-0" aria-hidden>
                            {countryFlagEmoji(countryIso)}
                          </span>
                          <span className="truncate text-xs sm:text-sm">
                            {countryLabel(countryIso)} {dialForIso2(countryIso)}
                          </span>
                        </span>
                        <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" aria-hidden />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[min(100vw-2rem,var(--radix-popover-trigger-width))] max-w-[min(100vw-2rem,20rem)] p-0"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Search country or code…" />
                        <CommandList className="max-h-[min(60vh,280px)]">
                          <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                            No country found.
                          </CommandEmpty>
                          <CommandGroup>
                            {SORTED_ISO2.map((iso) => (
                              <CommandItem
                                key={iso}
                                value={`${countryLabel(iso)} ${iso} ${dialForIso2(iso)}`}
                                onSelect={() => {
                                  setCountryIso(iso)
                                  setCountryPickerOpen(false)
                                  setMobileSaved(false)
                                  setMobileError(null)
                                }}
                                className="flex cursor-pointer items-center gap-2"
                              >
                                <span className="shrink-0" aria-hidden>
                                  {countryFlagEmoji(iso)}
                                </span>
                                <span className="min-w-0 flex-1 truncate">{countryLabel(iso)}</span>
                                <span className="shrink-0 text-muted-foreground tabular-nums">
                                  {dialForIso2(iso)}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Input
                    placeholder="123 456 7890"
                    value={mobilePhone}
                    onChange={(e) => {
                      setMobilePhone(e.target.value)
                      setMobileSaved(false)
                      setMobileError(null)
                    }}
                  />
                </div>
              </div>
              <Input
                placeholder="Optional message"
                value={mobileMessage}
                onChange={(e) => {
                  setMobileMessage(e.target.value)
                  setMobileSaved(false)
                  setMobileError(null)
                }}
              />
              <label className="flex items-start gap-3 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 rounded border-border"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  I consent to the recording, storage and sharing of my communications as described by
                  the Terms of Service and Privacy Policy.Msg & data rates may apply.
                </span>
              </label>
              <div className="mt-auto flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 rounded-full border-border"
                  onClick={() => {
                    setMobileName('John')
                    setCountryIso('US')
                    setMobilePhone('')
                    setMobileMessage('')
                    setConsent(false)
                    setMobileSaved(false)
                    setMobileError(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-full bg-primary text-primary-foreground hover:opacity-90"
                  disabled={!mobilePhone.trim() || !consent || mobileSubmitting}
                  onClick={() => void submitMobileCallback()}
                >
                  {mobileSubmitting ? 'Submitting...' : 'Get a call'}
                </Button>
              </div>
              <Button
                variant="ghost"
                className="w-full text-xs"
                onClick={() => setShowContactPopup(true)}
              >
                We will not share your details with anyone.
              </Button>
              {mobileSaved && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Request sent. A human agent will call you soon.</p>
              )}
              {mobileError && (
                <p className="text-xs text-destructive">{mobileError}</p>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="p-3 pt-2">
          {tab === 'voice' ? (
            <div className="w-full flex items-center justify-center gap-3">
              {voiceActive ? (
                <div className="flex flex-col items-center gap-2">
                  <Button
                    className="h-14 w-14 rounded-full bg-primary p-0 text-primary-foreground hover:opacity-90"
                    onClick={() => setVoiceActive(false)}
                    title="End call"
                  >
                    <PhoneOff className="h-5 w-5" />
                  </Button>
                  <span className="text-sm text-muted-foreground">End call</span>
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center gap-2">
                    <Button
                      type="button"
                      className="h-14 w-14 rounded-full p-0"
                      title="Call Agent"
                      onClick={() => void startAiVoiceCall()}
                    >
                      <PhoneCall className="h-5 w-5" />
                    </Button>
                    <span className="text-sm text-muted-foreground">Call Agent</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <Button
                      type="button"
                      variant={callHumenOpen ? 'default' : 'outline'}
                      className="h-14 w-14 shrink-0 rounded-full p-0"
                      title={
                        callHumenOpen
                          ? 'Hide numbers & social apps'
                          : 'Call Humen — show numbers, dial, and social apps'
                      }
                      aria-pressed={callHumenOpen}
                      onClick={() => setCallHumenOpen((o) => !o)}
                    >
                      <Users className="h-5 w-5" />
                    </Button>
                    <span className="text-sm text-muted-foreground">Call Humen</span>
                  </div>
                </>
              )}
            </div>
          ) : tab === 'mobile' ? (
            <p className="w-full text-center text-xs text-muted-foreground">
              Fill your callback details and submit above.
            </p>
          ) : (
            <div className="flex w-full flex-col gap-2">
              <form onSubmit={handleSubmit} className="flex w-full items-center gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message…"
                  className="flex-1"
                  disabled={status === 'thinking'}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={!input.trim() || status === 'thinking'}
                  onClick={() => {
                    if (status === 'thinking') return
                    void sendMessage(input)
                  }}
                >
                  <Send className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setTab('voice')
                  }}
                  title="Voice tab"
                  className="text-primary hover:text-primary"
                >
                  <AudioLines className="h-4 w-4" />
                </Button>
              </form>
            </div>
          )}
        </CardFooter>

        {showContactPopup && (
          <div className="absolute inset-0 z-20 bg-background/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-xs rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-sm font-medium text-center">Call/Message Creator</p>
              <p className="text-xs text-muted-foreground text-center">
                WhatsApp, Messenger, Telegram, or WeChat
              </p>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleContactRedirect('WHATSAPP')}
                  disabled={!buildContactLink('WHATSAPP', whatsapp)}
                >
                  WhatsApp
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleContactRedirect('MESSENGER')}
                  disabled={!buildContactLink('MESSENGER', messenger)}
                >
                  Messenger
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleContactRedirect('TELEGRAM')}
                  disabled={!buildContactLink('TELEGRAM', telegram)}
                >
                  Telegram
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleContactRedirect('WECHAT')}
                  disabled={!buildContactLink('WECHAT', wechat)}
                >
                  WeChat
                </Button>
              </div>
              <Button variant="ghost" className="w-full" onClick={() => setShowContactPopup(false)}>
                Close
              </Button>
              {!whatsapp && !telegram && !messenger && !wechat && (
                <p className="text-xs text-destructive text-center">
                  No business contact accounts linked yet.
                </p>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
