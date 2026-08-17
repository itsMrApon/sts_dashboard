'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Message } from '@/components/ui/chat-message'
import { Chat } from '@/components/ui/chat'
import { askLeadMeetingChat } from '@/actions/callIntel'

type Props = {
  meetingId: string | null
  meetingLabel: string | null
  hasGeminiKey: boolean
  hasSummary: boolean
  seedPrompt?: string | null
  onSeedConsumed?: () => void
  noMeetingHint?: string | null
}

const SUGGESTIONS = [
  'What were the main pain points?',
  'Summarize action items for the lead',
  'What objections came up?',
  'What did they say about budget or timeline?',
]

export function MeetingChat({
  meetingId,
  meetingLabel,
  hasGeminiKey,
  hasSummary,
  seedPrompt,
  onSeedConsumed,
  noMeetingHint,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    setMessages([])
    setInput('')
  }, [meetingId])

  useEffect(() => {
    if (!seedPrompt?.trim() || !meetingId || !hasSummary || !hasGeminiKey) {
      return
    }
    setInput(seedPrompt)
    onSeedConsumed?.()
  }, [seedPrompt, meetingId, hasSummary, hasGeminiKey, onSeedConsumed])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isGenerating || !meetingId) return

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text.trim(),
        createdAt: new Date(),
      }
      const nextMessages = [...messages, userMsg]
      setMessages(nextMessages)
      setInput('')
      setIsGenerating(true)

      try {
        const history = nextMessages.slice(0, -1).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))

        const res = await askLeadMeetingChat({
          meetingId,
          message: text.trim(),
          history,
        })

        if (!res.ok) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: res.error || 'Could not get an answer',
              createdAt: new Date(),
            },
          ])
          return
        }

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: res.data?.reply || '',
            createdAt: new Date(),
          },
        ])
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content:
              'Could not reach the assistant. Check your connection and try again.',
            createdAt: new Date(),
          },
        ])
      } finally {
        setIsGenerating(false)
      }
    },
    [isGenerating, meetingId, messages],
  )

  const append = useCallback(
    (msg: { role: 'user'; content: string }) => {
      void sendMessage(msg.content)
    },
    [sendMessage],
  )

  const handleSubmit = useCallback(
    (event?: { preventDefault?: () => void }) => {
      event?.preventDefault?.()
      void sendMessage(input)
    },
    [input, sendMessage],
  )

  const emptyHint = useMemo(() => {
    if (!meetingId) {
      return (
        noMeetingHint ||
        'Sync a Fathom meeting to ask questions about the call.'
      )
    }
    if (!hasSummary) {
      return 'This meeting has no summary yet. Run Sync Fathom from /lead setup.'
    }
    if (!hasGeminiKey) {
      return 'Add a Gemini API key in Config Agent to use meeting chat.'
    }
    return null
  }, [hasGeminiKey, hasSummary, meetingId, noMeetingHint])

  if (emptyHint) {
    return (
      <div className="text-muted-foreground flex h-full min-h-0 flex-col items-center justify-center gap-3 px-6 text-center text-sm">
        <p>{emptyHint}</p>
        {!hasGeminiKey ? (
          <Link href="/ai-agents/config" className="text-primary underline">
            Open Config Agent
          </Link>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden px-1 pb-1">
      {meetingLabel ? (
        <p className="text-muted-foreground shrink-0 px-2 text-xs">
          Asking about {meetingLabel}
        </p>
      ) : null}
      <Chat
        className="min-h-0 flex-1"
        messages={messages}
        input={input}
        handleInputChange={(e) => setInput(e.target.value)}
        handleSubmit={handleSubmit}
        isGenerating={isGenerating}
        append={append}
        suggestions={SUGGESTIONS}
        setMessages={setMessages}
      />
    </div>
  )
}
