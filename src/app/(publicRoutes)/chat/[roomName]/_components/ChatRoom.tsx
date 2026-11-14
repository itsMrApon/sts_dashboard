'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Loader2, SendHorizontal, ShoppingBag, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { fetchWithFirstPartySession } from '@/lib/embed/firstPartySessionClient'
import { accentHex, type ChatServiceConfig } from '@/lib/services/types'
import { cn } from '@/lib/utils'
import { humanRowsFromSocial, type SocialAccountInput } from '../../../speak/[roomName]/_lib/humanContacts'
import { ServiceCard } from '../../../_components/PublicServiceShell'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  buyNowLink?: string | null
  roomJoinLink?: string | null
}

type Props = {
  roomName: string
  agentName: string
  config: ChatServiceConfig
  /** The owner sees the real error (e.g. a missing key); visitors get a neutral reply. */
  isOwner: boolean
  /** The business's WhatsApp / Messenger / Telegram, for "Talk to a person" (when turned on). */
  socialAccounts: SocialAccountInput[]
}

/** Stable per-browser id so the AI keeps this visitor's conversation together. */
function useSessionId(roomName: string): string {
  const [sessionId] = useState(() => {
    const key = `chat-session-${roomName}`
    try {
      const existing = localStorage.getItem(key)
      if (existing) return existing
      const created = Math.random().toString(36).slice(2)
      localStorage.setItem(key, created)
      return created
    } catch {
      return Math.random().toString(36).slice(2)
    }
  })
  return sessionId
}

export function ChatRoom({ roomName, agentName, config, isOwner, socialAccounts }: Props) {
  const accent = accentHex(config.accent)
  const displayName = config.assistantName || agentName
  const people = useMemo(
    () => (config.showHumanHandoff ? humanRowsFromSocial(socialAccounts).slice(0, 4) : []),
    [config.showHumanHandoff, socialAccounts],
  )
  const sessionId = useSessionId(roomName)
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: config.greeting }])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  const send = useCallback(
    async (text: string) => {
      const message = text.trim().slice(0, config.maxMessageLength)
      if (!message || thinking) return
      setDraft('')
      setMessages((current) => [...current, { role: 'user', content: message }])
      setThinking(true)
      try {
        const res = await fetchWithFirstPartySession(roomName, `/api/chat/${encodeURIComponent(roomName)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, sessionId }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          reply?: string
          error?: string
          buyNowLink?: string | null
          roomJoinLink?: string | null
        }
        if (!res.ok || !data.reply) {
          if (isOwner && data.error) toast.error(data.error)
          setMessages((current) => [...current, { role: 'assistant', content: config.fallbackMessage }])
          return
        }
        setMessages((current) => [
          ...current,
          {
            role: 'assistant',
            content: data.reply!,
            buyNowLink: config.includeLinks ? data.buyNowLink : null,
            roomJoinLink: config.includeLinks ? data.roomJoinLink : null,
          },
        ])
      } catch {
        setMessages((current) => [...current, { role: 'assistant', content: 'Connection lost. Please try again.' }])
      } finally {
        setThinking(false)
        inputRef.current?.focus()
      }
    },
    [config.fallbackMessage, config.includeLinks, config.maxMessageLength, isOwner, roomName, sessionId, thinking],
  )

  const showSuggestions = messages.length === 1 && config.suggestions.length > 0

  return (
    <ServiceCard className="flex h-[min(640px,calc(100dvh-170px))] min-h-[420px] flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <span
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: accent }}
        >
          {displayName.charAt(0).toUpperCase()}
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#05060f] bg-emerald-400" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <p className="text-[11px] text-zinc-400">{thinking ? 'Typing…' : 'Online · replies instantly'}</p>
        </div>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-4 py-4 text-sm" aria-live="polite">
        {messages.map((message, index) => (
          <div key={index} className={cn('flex flex-col gap-1.5', message.role === 'user' ? 'items-end' : 'items-start')}>
            <p
              className={cn(
                'w-fit max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2',
                message.role === 'user' ? 'rounded-br-md text-white' : 'rounded-bl-md bg-white/[0.08]',
              )}
              style={message.role === 'user' ? { backgroundColor: accent } : undefined}
            >
              {message.content}
            </p>
            {message.buyNowLink || message.roomJoinLink ? (
              <div className="flex flex-wrap gap-1.5">
                {message.buyNowLink ? (
                  <a
                    href={message.buyNowLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                    style={{ backgroundColor: accent }}
                  >
                    <ShoppingBag className="h-3.5 w-3.5" aria-hidden />
                    Buy now
                  </a>
                ) : null}
                {message.roomJoinLink ? (
                  <a
                    href={message.roomJoinLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs hover:bg-white/10"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    Open
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
        {thinking ? <Loader2 className="h-4 w-4 animate-spin text-zinc-400" aria-label="Thinking" /> : null}
      </div>

      {showSuggestions ? (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {config.suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void send(suggestion)}
              className="rounded-full border border-white/15 px-3 py-1 text-xs text-zinc-200 hover:bg-white/10"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      {people.length ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-white/10 px-4 py-2">
          <span className="flex items-center gap-1 text-[11px] text-zinc-400">
            <UserRound className="h-3 w-3" aria-hidden />
            Talk to a person
          </span>
          {people.map((row) => (
            <a
              key={row.id}
              href={row.telHref ?? row.web}
              target={row.telHref ? undefined : '_blank'}
              rel="noopener noreferrer"
              className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-white/10"
            >
              {row.displayKind}
            </a>
          ))}
        </div>
      ) : null}

      <form
        className="flex items-center gap-2 border-t border-white/10 p-3"
        onSubmit={(event) => {
          event.preventDefault()
          void send(draft)
        }}
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={config.inputPlaceholder}
          maxLength={config.maxMessageLength}
          aria-label="Message"
          className="h-10 min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm text-zinc-50 placeholder:text-zinc-500 focus:border-white/30 focus:outline-none"
        />
        <button
          type="submit"
          disabled={thinking || !draft.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-40"
          style={{ backgroundColor: accent }}
          aria-label="Send"
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </form>
    </ServiceCard>
  )
}
