'use client'

import { useState, useTransition } from 'react'
import { Gauge, MessageSquare, MessagesSquare, Palette, Plus, RotateCcw, ShieldCheck, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { saveAssistantBehaviour, type AssistantSummary } from '@/actions/assistants'
import { PublicServiceShell } from '@/app/(publicRoutes)/_components/PublicServiceShell'
import { ChatRoom } from '@/app/(publicRoutes)/chat/[roomName]/_components/ChatRoom'
import type { SocialAccountInput } from '@/app/(publicRoutes)/speak/[roomName]/_lib/humanContacts'
import { saveServiceLook } from '@/actions/services'
import { ServiceAssistantPicker } from '@/components/services/studio/ServiceAssistantPicker'
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
import {
  REPLY_LANGUAGES,
  REPLY_LENGTHS,
  SERVICE_LIMITS,
  TONES,
  type ChatServiceConfig,
  type ServiceState,
} from '@/lib/services/types'
import { guardAction } from '@/lib/clientActionErrors'

/** AI Agents → a chat assistant: everything about how it talks. */
const ASSISTANT_SECTIONS = [
  { id: 'persona', label: 'Persona' },
  { id: 'conversation', label: 'Conversation' },
  { id: 'behaviour', label: 'Behaviour' },
  { id: 'limits', label: 'Limits' },
]

type Props =
  | {
      /** Services → Chat AI: switch, looks, website code. */
      mode: 'service'
      roomName: string
      businessName: string
      /** For "Talk to a person" in the live view. */
      socialAccounts: SocialAccountInput[]
      initial: ServiceState<ChatServiceConfig>
      assistants: AssistantSummary[]
      assistant: { id: string; name: string } | null
    }
  | {
      /** AI Agents → this assistant's chat behaviour (saved on the assistant). */
      mode: 'assistant'
      roomName: string
      assistant: { id: string; name: string }
      initialConfig: ChatServiceConfig
      /** Shown in the status pill: is this assistant running Chat AI right now? */
      live: boolean
    }

const LENGTH_OPTIONS = REPLY_LENGTHS.map(({ id, label }) => ({ id, label }))
const label = <T extends string>(options: readonly { id: T; label: string }[], id: T) =>
  options.find((option) => option.id === id)?.label ?? id

export function ChatConfigurator(props: Props) {
  const { roomName } = props
  const isAssistant = props.mode === 'assistant'
  const agentName = props.assistant?.name ?? 'Your assistant'
  const initial = props.mode === 'service' ? props.initial : { enabled: props.live, config: props.initialConfig }
  const [enabled, setEnabled] = useState(initial.enabled)
  const [config, setConfig] = useState(initial.config)
  const [saved, setSaved] = useState(() => JSON.stringify({ enabled: initial.enabled, config: initial.config }))
  const [isSaving, startSaving] = useTransition()
  const [newSuggestion, setNewSuggestion] = useState('')
  const [liveKey, setLiveKey] = useState(0)

  const dirty = JSON.stringify({ enabled, config }) !== saved
  // The status pill shows what visitors get now, i.e. the last saved switch.
  const savedEnabled = (JSON.parse(saved) as { enabled: boolean }).enabled
  const patch = (partial: Partial<ChatServiceConfig>) => setConfig((current) => ({ ...current, ...partial }))
  const displayName = config.assistantName || agentName

  const save = () =>
    startSaving(guardAction(async () => {
      if (props.mode === 'assistant') {
        const result = await saveAssistantBehaviour(props.assistant.id, 'chat', config)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        setSaved(JSON.stringify({ enabled, config }))
        toast.success('Chat behaviour saved')
        return
      }
      const result = await saveServiceLook({ service: 'chat', enabled, look: { accent: config.accent } })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setConfig(result.config)
      setEnabled(result.enabled)
      setSaved(JSON.stringify({ enabled: result.enabled, config: result.config }))
      toast.success('Chat AI saved')
    }))

  const toggleLive = (next: boolean) => {
    if (next && props.mode === 'service' && !props.assistant) {
      toast.error('Pick an assistant for Chat AI first.')
      return
    }
    setEnabled(next)
  }

  const addSuggestion = () => {
    const value = newSuggestion.trim()
    if (!value || config.suggestions.length >= SERVICE_LIMITS.maxSuggestions) return
    patch({ suggestions: [...config.suggestions, value.slice(0, SERVICE_LIMITS.suggestion)] })
    setNewSuggestion('')
  }

  const hostedPath = `/chat/${encodeURIComponent(roomName)}`
  const live =
    props.mode === 'service'
      ? {
          href: hostedPath,
          actions: (
            <button
              type="button"
              onClick={() => setLiveKey((key) => key + 1)}
              aria-label="Restart the chat"
              title="Restart the chat"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          ),
          content: (
            <PublicServiceShell businessName={props.businessName} service="chat" links={{}} embedded>
              <ChatRoom
                key={liveKey}
                roomName={roomName}
                agentName={agentName}
                config={config}
                isOwner
                socialAccounts={props.socialAccounts}
              />
            </PublicServiceShell>
          ),
        }
      : undefined

  return (
    <ServiceStudio
      name={isAssistant ? `${agentName} · Chat` : 'Chat AI'}
      icon={MessageSquare}
      tagline={isAssistant ? 'How this assistant chats: persona, greeting, behaviour. Colours live in Services → Chat AI.' : undefined}
      status={
        isAssistant
          ? { live: initial.enabled, label: initial.enabled ? 'Running Chat AI' : 'Not in use' }
          : { live: savedEnabled, label: savedEnabled ? 'Live' : 'Off' }
      }
      toggle={isAssistant ? undefined : { label: 'On website', checked: enabled, onChange: toggleLive, requiresWebsite: !savedEnabled }}
      dirty={dirty}
      saving={isSaving}
      onSave={save}
      sections={isAssistant ? ASSISTANT_SECTIONS : undefined}
      live={live}
      guide={
        isAssistant
          ? undefined
          : { service: 'chat', notice: enabled ? null : 'Chat AI is off. Turn it on and save so your site can use it.' }
      }
    >
      {props.mode === 'service' ? (
        <ServiceAssistantPicker service="chat" assistants={props.assistants} currentId={props.assistant?.id ?? null} />
      ) : null}
      {isAssistant ? (
      <>
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
          hint={`Shown on the chat header. Empty uses the assistant's name (${agentName}).`}
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
      </>
      ) : null}

      {!isAssistant ? (
      <StudioSection
        id="look"
        icon={Palette}
        accent="rose"
        title="Look"
      >
        <Field label="Accent colour">
          <AccentPicker value={config.accent} onChange={(value) => patch({ accent: value })} />
        </Field>
      </StudioSection>
      ) : null}

      {isAssistant ? (
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
      ) : null}
    </ServiceStudio>
  )
}
