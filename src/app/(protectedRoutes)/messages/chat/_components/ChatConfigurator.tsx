'use client'

import { useRef, useState, useTransition } from 'react'
import {
  Gauge,
  Loader2,
  MessageSquare,
  MessagesSquare,
  Palette,
  Plus,
  RotateCcw,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { saveChatService } from '@/actions/services'
import { ServiceStudio } from '@/components/services/studio/ServiceStudio'
import {
  AccentPicker,
  ChoiceCards,
  Field,
  Segmented,
  StudioSection,
  ToggleRow,
} from '@/components/services/studio/StudioPrimitives'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { fetchWithFirstPartySession } from '@/lib/embed/firstPartySessionClient'
import { SERVICE_SNIPPETS } from '@/lib/services/snippets'
import {
  ACCENTS,
  REPLY_LANGUAGES,
  REPLY_LENGTHS,
  SERVICE_LIMITS,
  TONES,
  accentHex,
  type ChatServiceConfig,
  type ServiceState,
} from '@/lib/services/types'
import { cn } from '@/lib/utils'
import { guardAction } from '@/lib/clientActionErrors'

type PreviewMessage = { role: 'user' | 'assistant'; content: string }

const SECTIONS = [
  { id: 'persona', label: 'Persona' },
  { id: 'conversation', label: 'Conversation' },
  { id: 'behaviour', label: 'Behaviour' },
  { id: 'look', label: 'Look' },
  { id: 'limits', label: 'Limits' },
]

const LENGTH_OPTIONS = REPLY_LENGTHS.map(({ id, label }) => ({ id, label }))
const label = <T extends string>(options: readonly { id: T; label: string }[], id: T) =>
  options.find((option) => option.id === id)?.label ?? id

export function ChatConfigurator({
  roomName,
  agentName,
  initial,
}: {
  roomName: string
  /** The business agent's name: the default chat header name. */
  agentName: string
  initial: ServiceState<ChatServiceConfig>
}) {
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
  // The status pill shows what visitors get now, i.e. the last saved switch.
  const savedEnabled = (JSON.parse(saved) as { enabled: boolean }).enabled
  const patch = (partial: Partial<ChatServiceConfig>) => setConfig((current) => ({ ...current, ...partial }))
  const accent = accentHex(config.accent)
  const displayName = config.assistantName || agentName

  const save = () =>
    startSaving(guardAction(async () => {
      const result = await saveChatService({ enabled, config })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setConfig(result.config)
      setSaved(JSON.stringify({ enabled, config: result.config }))
      toast.success('Chat AI saved')
    }))

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
      if (!response.ok || !data.reply) {
        // The owner sees the real reason (e.g. no AI key); visitors would get the fallback message.
        if (data.error) toast.error(data.error)
        setMessages((current) => [...current, { role: 'assistant', content: config.fallbackMessage }])
        return
      }
      setMessages((current) => [...current, { role: 'assistant', content: data.reply! }])
    } catch {
      setMessages((current) => [...current, { role: 'assistant', content: config.fallbackMessage }])
    } finally {
      setThinking(false)
    }
  }

  const preview = (
    <div className="flex h-[560px] flex-col bg-background/40">
      <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3">
        <span
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: accent }}
        >
          {displayName.charAt(0).toUpperCase() || 'A'}
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-400" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <p className="text-[11px] text-muted-foreground">{thinking ? 'Typing…' : 'Online · replies instantly'}</p>
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4 text-sm">
        <p className="w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-muted px-3 py-2">{config.greeting}</p>
        {messages.map((message, index) => (
          <p
            key={index}
            className={cn(
              'w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2',
              message.role === 'user' ? 'ml-auto rounded-tr-sm text-white' : 'rounded-tl-sm bg-muted',
            )}
            style={message.role === 'user' ? { backgroundColor: accent } : undefined}
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
      {config.showHumanHandoff ? (
        <p className="px-4 pb-2 text-[11px] text-muted-foreground">
          <UserRound className="mr-1 inline h-3 w-3" aria-hidden />
          Visitors also see “Talk to a person” with your WhatsApp, Messenger or phone.
        </p>
      ) : null}
      <form
        className="flex gap-2 border-t border-border/70 p-3"
        onSubmit={(event) => {
          event.preventDefault()
          void send(draft)
        }}
      >
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={config.inputPlaceholder} maxLength={config.maxMessageLength} />
        <button
          type="submit"
          disabled={thinking || !draft.trim()}
          className="rounded-lg px-3 text-white disabled:opacity-50"
          style={{ backgroundColor: accent }}
          aria-label="Send"
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </form>
    </div>
  )

  return (
    <ServiceStudio
      name="Chat AI"
      icon={MessageSquare}
      tagline="Text chat with your business AI, on your site and on its own page."
      status={{ live: savedEnabled, label: savedEnabled ? 'Live' : 'Off' }}
      toggle={{ label: 'On website', checked: enabled, onChange: setEnabled }}
      publicHref={`/chat/${encodeURIComponent(roomName)}`}
      dirty={dirty}
      saving={isSaving}
      onSave={save}
      sections={SECTIONS}
      preview={preview}
      previewTitle="chat · live preview"
      previewActions={
        messages.length ? (
          <button
            type="button"
            onClick={() => setMessages([])}
            aria-label="Restart the preview chat"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        ) : null
      }
      integrate={{
        serviceName: 'Chat AI',
        roomName,
        snippet: SERVICE_SNIPPETS.chat,
        snippetFile: 'components/ChatPopup.tsx',
        hostedHref: `/chat/${encodeURIComponent(roomName)}`,
        offNotice: enabled ? null : 'Chat AI is off. Turn it on and save, or the SDK and hosted page will refuse chats.',
      }}
    >
      <StudioSection
        id="persona"
        icon={Sparkles}
        title="Persona"
        description="Who visitors are talking to and how it sounds. Facts still come from your agent's prompt."
        summary={[
          { label: 'name', value: displayName },
          { label: 'tone', value: label(TONES, config.tone) },
          { label: 'length', value: label(REPLY_LENGTHS, config.replyLength) },
          { label: 'language', value: label(REPLY_LANGUAGES, config.replyLanguage) },
        ]}
      >
        <Field
          label="Assistant name"
          htmlFor="chat-name"
          hint={`Shown on the chat header. Empty uses your agent's name (${agentName}).`}
          counter={`${config.assistantName.length}/${SERVICE_LIMITS.assistantName}`}
        >
          <Input
            id="chat-name"
            value={config.assistantName}
            maxLength={SERVICE_LIMITS.assistantName}
            placeholder={agentName}
            onChange={(e) => patch({ assistantName: e.target.value })}
          />
        </Field>
        <Field label="Tone">
          <ChoiceCards ariaLabel="Tone" value={config.tone} options={TONES} onChange={(tone) => patch({ tone })} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Reply length" hint={REPLY_LENGTHS.find((item) => item.id === config.replyLength)?.hint}>
            <Segmented ariaLabel="Reply length" value={config.replyLength} options={LENGTH_OPTIONS} onChange={(replyLength) => patch({ replyLength })} />
          </Field>
          <Field label="Reply language" hint="Bangla replies stay in Bengali script.">
            <Segmented
              ariaLabel="Reply language"
              value={config.replyLanguage}
              options={REPLY_LANGUAGES.map(({ id }) => ({ id, label: id === 'auto' ? 'Auto' : id === 'en' ? 'English' : 'বাংলা' }))}
              onChange={(replyLanguage) => patch({ replyLanguage })}
            />
          </Field>
        </div>
      </StudioSection>

      <StudioSection
        id="conversation"
        icon={MessagesSquare}
        accent="sky"
        title="Conversation"
        description="The first thing visitors see, and one-tap questions to get them started."
        summary={[
          { label: 'greeting', value: config.greeting },
          { label: 'suggestions', value: `${config.suggestions.length} of ${SERVICE_LIMITS.maxSuggestions}` },
          { label: 'placeholder', value: config.inputPlaceholder },
        ]}
      >
        <Field label="Greeting" htmlFor="chat-greeting" counter={`${config.greeting.length}/${SERVICE_LIMITS.greeting}`}>
          <Textarea
            id="chat-greeting"
            value={config.greeting}
            maxLength={SERVICE_LIMITS.greeting}
            onChange={(e) => patch({ greeting: e.target.value })}
            rows={2}
          />
        </Field>
        <Field label="Suggested questions" hint="Shown until the visitor sends their first message.">
          <div className="space-y-2">
            {config.suggestions.length ? (
              <div className="flex flex-wrap gap-1.5">
                {config.suggestions.map((suggestion, index) => (
                  <span key={`${suggestion}-${index}`} className="flex items-center gap-1 rounded-full border border-border bg-muted/30 py-1 pl-3 pr-1 text-xs">
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
            ) : null}
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
                  aria-label="New suggested question"
                />
                <button type="button" onClick={addSuggestion} className="rounded-lg border border-border px-3 hover:bg-muted/60" aria-label="Add suggestion">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>
        </Field>
        <Field label="Input placeholder" htmlFor="chat-placeholder">
          <Input
            id="chat-placeholder"
            value={config.inputPlaceholder}
            maxLength={SERVICE_LIMITS.placeholder}
            onChange={(e) => patch({ inputPlaceholder: e.target.value })}
          />
        </Field>
      </StudioSection>

      <StudioSection
        id="behaviour"
        icon={ShieldCheck}
        accent="emerald"
        title="Behaviour"
        description="What replies can include, when to hand over to a person, and what to say if the AI can't answer."
        summary={[
          { label: 'links', value: config.includeLinks ? 'product & CTA links on' : 'off' },
          { label: 'human handoff', value: config.showHumanHandoff ? 'on' : 'off' },
          { label: 'fallback', value: config.fallbackMessage },
        ]}
      >
        <ToggleRow
          label="Include product & CTA links"
          hint="Replies can bring Buy now and join links your site shows as buttons."
          checked={config.includeLinks}
          onChange={(includeLinks) => patch({ includeLinks })}
        />
        <ToggleRow
          label="Talk to a person"
          hint="Show your WhatsApp, Messenger, Telegram or phone (from Business → Social) under the chat."
          checked={config.showHumanHandoff}
          onChange={(showHumanHandoff) => patch({ showHumanHandoff })}
        />
        <Field
          label="If the AI can't answer"
          htmlFor="chat-fallback"
          hint="Visitors see this when the AI is unavailable (for example, a missing key). You see the real reason."
          counter={`${config.fallbackMessage.length}/${SERVICE_LIMITS.fallbackMessage}`}
        >
          <Textarea
            id="chat-fallback"
            value={config.fallbackMessage}
            maxLength={SERVICE_LIMITS.fallbackMessage}
            onChange={(e) => patch({ fallbackMessage: e.target.value })}
            rows={2}
          />
        </Field>
      </StudioSection>

      <StudioSection
        id="look"
        icon={Palette}
        accent="rose"
        title="Look"
        description="Your brand colour on the hosted chat page. The SDK passes it to your designer as `accent`."
        summary={[{ label: 'accent', value: `${ACCENTS.find((item) => item.id === config.accent)?.label} ${accent}` }]}
      >
        <Field label="Accent colour">
          <AccentPicker value={config.accent} onChange={(value) => patch({ accent: value })} />
        </Field>
      </StudioSection>

      <StudioSection
        id="limits"
        icon={Gauge}
        accent="amber"
        title="Limits"
        description="Keeps conversations focused and your AI costs predictable. Daily caps per business still apply."
        summary={[{ label: 'max message', value: `${config.maxMessageLength} characters` }]}
      >
        <Field label="Max message length" htmlFor="chat-max" hint={`${SERVICE_LIMITS.maxMessageLengthMin}–${SERVICE_LIMITS.maxMessageLengthMax} characters.`}>
          <Input
            id="chat-max"
            type="number"
            min={SERVICE_LIMITS.maxMessageLengthMin}
            max={SERVICE_LIMITS.maxMessageLengthMax}
            value={config.maxMessageLength}
            onChange={(e) => patch({ maxMessageLength: Number(e.target.value) || SERVICE_LIMITS.maxMessageLengthMin })}
            className="max-w-[160px]"
          />
        </Field>
      </StudioSection>
    </ServiceStudio>
  )
}
