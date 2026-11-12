'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Loader2, SendHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { sendOfferChat } from '@/actions/buyer'
import type { OfferChatMessage, PublicOfferView } from '@/lib/offers/publicOfferTypes'

type Props = {
  offer: PublicOfferView
  initialMessages: OfferChatMessage[]
  /** Called when the AI decides the buyer is ready to order. */
  onOrderRequested: () => void
}

const SUGGESTIONS = ['What exactly do I get?', 'How long does it take?', 'Can I pay in parts?']

/** Chat with the business AI about this offer; history is kept per buyer. */
export function OfferChat({ offer, initialMessages, onOrderRequested }: Props) {
  const [messages, setMessages] = useState<OfferChatMessage[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

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
      setMessages((current) => [...current, { role: 'assistant', content: result.reply }])
      if (result.showOrder) onOrderRequested()
    } catch {
      toast.error('Network error. Please try again.')
      setMessages((current) => current.slice(0, -1))
      setDraft(message)
    } finally {
      setThinking(false)
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border">
      <div ref={listRef} className="max-h-[360px] min-h-[160px] space-y-2 overflow-y-auto p-3 text-sm" aria-live="polite">
        {messages.length === 0 ? (
          <p className="w-fit max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2">
            Hi! Ask me anything about {offer.title}.
          </p>
        ) : null}
        {messages.map((message, index) => (
          <p
            key={index}
            className={cn(
              'w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2',
              message.role === 'user' ? 'ml-auto rounded-tr-sm bg-primary text-primary-foreground' : 'rounded-tl-sm bg-muted',
            )}
          >
            {message.content}
          </p>
        ))}
        {thinking ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Thinking" /> : null}
      </div>
      {messages.length === 0 ? (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
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
        className="flex gap-2 border-t border-border p-2"
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
