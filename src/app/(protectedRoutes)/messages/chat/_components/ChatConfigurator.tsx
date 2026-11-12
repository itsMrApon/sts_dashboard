'use client'

import { useRef, useState, useTransition } from 'react'
import { Loader2, Plus, SendHorizontal, X } from 'lucide-react'
import { toast } from 'sonner'
import { saveChatService } from '@/actions/services'
import { ServiceConfigFrame } from '@/components/services/ServiceConfigFrame'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { fetchWithFirstPartySession } from '@/lib/embed/firstPartySessionClient'
import { SERVICE_SNIPPETS } from '@/lib/services/snippets'
import { SERVICE_LIMITS, type ChatServiceConfig, type ServiceState } from '@/lib/services/types'
import { cn } from '@/lib/utils'

type PreviewMessage = { role: 'user' | 'assistant'; content: string }

export function ChatConfigurator({ roomName, initial }: { roomName: string; initial: ServiceState<ChatServiceConfig> }) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [config, setConfig] = useState(initial.config)
  const [saved, setSaved] = useState(() => JSON.stringify(initial))
  const [isSaving, startSaving] = useTransition()
  const [newSuggestion, setNewSuggestion] = useState('')

  const [messages, setMessages] = useState<PreviewMessage[]>([])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const sessionIdRef = useRef(`preview-${Math.random().toString(36).slice(2, 10)}`)

  const dirty = JSON.stringify({ enabled, config }) !== saved
  const patch = (partial: Partial<ChatServiceConfig>) => setConfig((current) => ({ ...current, ...partial }))

  const save = () =>
    startSaving(async () => {
      const result = await saveChatService({ enabled, config })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setConfig(result.config)
      setSaved(JSON.stringify({ enabled, config: result.config }))
      toast.success('Chat AI saved')
    })

  const addSuggestion = () => {
    const value = newSuggestion.trim()
    if (!value || config.suggestions.length >= SERVICE_LIMITS.maxSuggestions) return
    patch({ suggestions: [...config.suggestions, value.slice(0, SERVICE_LIMITS.suggestion)] })
    setNewSuggestion('')
  }

  const send = async (text: string) => {
    const message = text.trim().slice(0, config.maxMessageLength)
    if (!message || thinking) return
    setMessages((current) => [...current, { role: 'user', content: message }])
    setDraft('')
    setThinking(true)
    try {
      const response = await fetchWithFirstPartySession(roomName, `/api/chat/${encodeURIComponent(roomName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId: sessionIdRef.current }),
      })
      const data = (await response.json()) as { reply?: string; error?: string }
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: data.reply || data.error || 'No reply — check your AI key in AI Agents → Config.' },
      ])
    } catch {
      setMessages((current) => [...current, { role: 'assistant', content: 'Network error' }])
    } finally {
      setThinking(false)
    }
  }

  const preview = (
    <div className="flex h-[520px] flex-col overflow-hidden rounded-3xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-medium">Live preview</p>
        <p className="text-xs text-muted-foreground">Real replies from your business AI. Your site&apos;s design will differ.</p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4 text-sm">
        <p className="w-fit max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2">{config.greeting}</p>
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
        {thinking ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
      </div>
      {messages.length === 0 && config.suggestions.length ? (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {config.suggestions.map((suggestion) => (
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
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask your AI…" maxLength={config.maxMessageLength} />
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

  return (
    <ServiceConfigFrame
      serviceName="Chat AI"
      roomName={roomName}
      enabled={enabled}
      onEnabledChange={setEnabled}
      dirty={dirty}
      saving={isSaving}
      onSave={save}
      preview={preview}
      snippet={SERVICE_SNIPPETS.chat}
    >
      <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-5">
        <h2 className="text-sm font-semibold">Conversation</h2>
        <div className="space-y-2">
          <Label htmlFor="chat-greeting">Greeting</Label>
          <Textarea
            id="chat-greeting"
            value={config.greeting}
            maxLength={SERVICE_LIMITS.greeting}
            onChange={(e) => patch({ greeting: e.target.value })}
            rows={2}
          />
          <p className="text-xs text-muted-foreground">The first message visitors see. The AI&apos;s instructions live on Overview.</p>
        </div>
        <div className="space-y-2">
          <Label>Suggested questions</Label>
          <div className="flex flex-wrap gap-1.5">
            {config.suggestions.map((suggestion, index) => (
              <span key={`${suggestion}-${index}`} className="flex items-center gap-1 rounded-full border border-border py-1 pl-3 pr-1 text-xs">
                {suggestion}
                <button
                  type="button"
                  onClick={() => patch({ suggestions: config.suggestions.filter((_, i) => i !== index) })}
                  className="rounded-full p-0.5 hover:bg-muted"
                  aria-label={`Remove ${suggestion}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          {config.suggestions.length < SERVICE_LIMITS.maxSuggestions ? (
            <div className="flex gap-2">
              <Input
                value={newSuggestion}
                maxLength={SERVICE_LIMITS.suggestion}
                onChange={(e) => setNewSuggestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addSuggestion()
                  }
                }}
                placeholder="Add a suggested question"
              />
              <button type="button" onClick={addSuggestion} className="rounded-lg border border-border px-3 hover:bg-muted/60" aria-label="Add suggestion">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-5">
        <h2 className="text-sm font-semibold">Limits & replies</h2>
        <div className="space-y-2">
          <Label htmlFor="chat-max">Max message length (characters)</Label>
          <Input
            id="chat-max"
            type="number"
            min={SERVICE_LIMITS.maxMessageLengthMin}
            max={SERVICE_LIMITS.maxMessageLengthMax}
            value={config.maxMessageLength}
            onChange={(e) => patch({ maxMessageLength: Number(e.target.value) || SERVICE_LIMITS.maxMessageLengthMin })}
            className="max-w-[160px]"
          />
        </div>
        <label className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
          <span>
            <span className="block text-sm">Include product & CTA links</span>
            <span className="block text-xs text-muted-foreground">Replies return links your site can show as buttons.</span>
          </span>
          <Switch checked={config.includeLinks} onCheckedChange={(includeLinks) => patch({ includeLinks })} />
        </label>
      </section>
    </ServiceConfigFrame>
  )
}
