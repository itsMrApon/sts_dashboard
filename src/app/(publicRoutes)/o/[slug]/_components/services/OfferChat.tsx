'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Loader2, SendHorizontal } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { pollOfferChat, sendOfferChat } from '@/actions/buyer'
import type { OfferChatMessage, PublicOfferView } from '@/lib/offers/publicOfferTypes'

type Props = {
  offer: PublicOfferView
  initialMessages: OfferChatMessage[]
  /** Called when the AI decides the buyer is ready to order. */
  onOrderRequested: () => void
}

const SUGGESTIONS = ['What exactly do I get?', 'How long does it take?', 'Can I pay in parts?']

/** How often to look for replies the creator types from their pipeline. */
const POLL_MS = 5000

/**
 * Chat with the business AI about this offer; history is kept per buyer. Fills its parent
 * (a panel in the AI room). The creator can join in from the pipeline; those replies are
 * labelled with the business name.
 */
export function OfferChat({ offer, initialMessages, onOrderRequested }: Props) {
  const [messages, setMessages] = useState<OfferChatMessage[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const thinkingRef = useRef(false)
  thinkingRef.current = thinking

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  useEffect(() => {
    // Chained (not setInterval): the next poll waits for the last one, so a slow server
    // never builds a queue of actions in front of the buyer's own message.
    let stopped = false
    let timer = 0
    const poll = async () => {
      // Skip while hidden or mid-turn (the turn's own result is about to land).
      if (document.visibilityState !== 'visible' || thinkingRef.current) return
      const result = await pollOfferChat({ slug: offer.slug }).catch(() => null)
      if (!result?.ok || thinkingRef.current) return
      // The server keeps the latest 30; take its copy whenever its newest message is new to us.
      setMessages((current) => {
        const theirs = result.messages.at(-1)
        const ours = current.at(-1)
        const changed = !!theirs && (theirs.content !== ours?.content || theirs.role !== ours?.role)
        return changed ? result.messages : current
      })
    }
    const loop = async () => {
      await poll()
      if (!stopped) timer = window.setTimeout(loop, POLL_MS)
    }
    timer = window.setTimeout(loop, POLL_MS)
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [offer.slug])

  const [handoff, setHandoff] = useState(false)

  const send = async (text: string) => {
    const message = text.trim()
    if (!message || thinking) return
    setDraft('')
    setMessages((current) => [...current, { role: 'user', content: message }])
    setThinking(true)
    try {
      const result = await sendOfferChat({ slug: offer.slug, message })
      if (!result.ok) {
        toast.error(result.error)
        setMessages((current) => current.slice(0, -1))
        setDraft(message)
        return
      }
      // No reply: a person has taken the chat over; their answer arrives with the next poll.
      const reply = result.reply
      if (reply) {
        setMessages((current) => [...current, { role: 'assistant', content: reply }])
        setHandoff(false)
      } else setHandoff(true)
      if (result.showOrder) onOrderRequested()
    } catch {
      toast.error("Looks like you're offline. Try again in a moment.")
      setMessages((current) => current.slice(0, -1))
      setDraft(message)
    } finally {
      setThinking(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-4 text-sm" aria-live="polite">
        {messages.length === 0 ? (
          <p className="w-fit max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2">
            Hi! Ask me anything about {offer.title}.
          </p>
        ) : null}
        {messages.map((message, index) => (
          <div key={index} className={cn('flex flex-col', message.role === 'user' ? 'items-end' : 'items-start')}>
            {message.from === 'creator' ? (
              <span className="mb-0.5 px-1 text-[11px] font-medium text-primary">{offer.business.name}</span>
            ) : null}
            <p
              className={cn(
                'w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2',
                message.role === 'user'
                  ? 'rounded-tr-sm bg-primary text-primary-foreground'
                  : message.from === 'creator'
                    ? 'rounded-tl-sm border border-primary/40 bg-primary/10'
                    : 'rounded-tl-sm bg-muted',
              )}
            >
              {message.content}
            </p>
          </div>
        ))}
        {thinking ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Thinking" /> : null}
        {handoff ? (
          <p className="px-1 text-center text-xs text-muted-foreground">{offer.business.name} will reply here in person.</p>
        ) : null}
      </div>
      {messages.length === 0 ? (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void send(suggestion)}
              className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted/60"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
      <form
        className="flex gap-2 border-t border-border p-3"
        onSubmit={(event) => {
          event.preventDefault()
          void send(draft)
        }}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type your question…"
          maxLength={2000}
          aria-label="Message"
        />
        <button
          type="submit"
          disabled={thinking || !draft.trim()}
          className="rounded-lg bg-primary px-3 text-primary-foreground disabled:opacity-50"
          aria-label="Send"
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}
