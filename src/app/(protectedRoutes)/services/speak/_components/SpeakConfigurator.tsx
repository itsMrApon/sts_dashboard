'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { AudioLines, Gauge, Palette, PhoneCall, Settings2, Sparkles, Timer } from 'lucide-react'
import { toast } from 'sonner'
import { saveAssistantBehaviour, type AssistantSummary } from '@/actions/assistants'
import { saveServiceLook } from '@/actions/services'
import { PublicServiceShell } from '@/app/(publicRoutes)/_components/PublicServiceShell'
import { SpeakRoom } from '@/app/(publicRoutes)/speak/[roomName]/_components/SpeakRoom'
import type { SocialAccountInput } from '@/app/(publicRoutes)/speak/[roomName]/_lib/humanContacts'
import { ServiceAssistantPicker } from '@/components/services/studio/ServiceAssistantPicker'
import { ServiceStudio } from '@/components/services/studio/ServiceStudio'
import { ChoiceCards, Field, Segmented, StudioSection, ToggleRow } from '@/components/services/studio/StudioPrimitives'
import { WizardGem } from '@/components/wizard/WizardGem'
import { Input } from '@/components/ui/input'
import {
  END_WARNINGS,
  REPLY_LENGTHS,
  SPEAKING_SPEEDS,
  SERVICE_LIMITS,
  TONES,
  type ServiceState,
  type SpeakServiceConfig,
} from '@/lib/services/types'
import { WIZARD_SHAPES, WIZARD_THEMES, type WizardThemeId } from '@/lib/wizard/types'
import { guardAction } from '@/lib/clientActionErrors'

/** The voice assistant's own first line and language (edited in its Prompt card). */
type VoiceAssistant = { id: string; name: string; firstMessage: string; language: string }

const ASSISTANT_SECTIONS = [
  { id: 'voice', label: 'Voice' },
  { id: 'persona', label: 'Persona' },
  { id: 'call', label: 'Call' },
]

type Props =
  | {
      /** Services → Voice AI: switch, orb and button, live call, website code. */
      mode: 'service'
      roomName: string
      businessName: string
      /** For "Talk to a person" in the live view. */
      socialAccounts: SocialAccountInput[]
      initial: ServiceState<SpeakServiceConfig>
      assistants: AssistantSummary[]
      assistant: VoiceAssistant | null
    }
  | {
      /** AI Agents → this assistant's call behaviour (saved on the assistant). */
      mode: 'assistant'
      roomName: string
      assistant: VoiceAssistant
      initialConfig: SpeakServiceConfig
      live: boolean
      /** Account-wide voice from AI Agents → Config (read-only here). */
      voiceLabel: string
      /** Cartesia, Fish and others can speak Bangla; Deepgram Aura voices are English-only. */
      voiceSpeaksBangla: boolean
    }

const CALL_LENGTHS = [3, 5, 10, 15, 30] as const
const label = <T extends string | number>(options: readonly { id: T; label: string }[], id: T) =>
  options.find((option) => option.id === id)?.label ?? String(id)

export function SpeakConfigurator(props: Props) {
  const { roomName } = props
  const isAssistant = props.mode === 'assistant'
  const initial = props.mode === 'service' ? props.initial : { enabled: props.live, config: props.initialConfig }
  const voice = {
    language: props.assistant?.language === 'bn' ? ('bn' as const) : ('en' as const),
    firstMessage: props.assistant?.firstMessage ?? '',
  }
  const [enabled, setEnabled] = useState(initial.enabled)
  const [config, setConfig] = useState(initial.config)
  const [saved, setSaved] = useState(() => JSON.stringify({ enabled: initial.enabled, config: initial.config }))
  const [isSaving, startSaving] = useTransition()

  const dirty = JSON.stringify({ enabled, config }) !== saved
  const savedEnabled = (JSON.parse(saved) as { enabled: boolean }).enabled
  const patch = (partial: Partial<SpeakServiceConfig>) => setConfig((current) => ({ ...current, ...partial }))

  const save = () =>
    startSaving(guardAction(async () => {
      if (props.mode === 'assistant') {
        const result = await saveAssistantBehaviour(props.assistant.id, 'voice', config)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        setSaved(JSON.stringify({ enabled, config }))
        toast.success('Call behaviour saved. New calls use it.')
        return
      }
      const { orbTheme, orbShape, callButtonLabel } = config
      const result = await saveServiceLook({ service: 'voice', enabled, look: { orbTheme, orbShape, callButtonLabel } })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setConfig(result.config)
      setEnabled(result.enabled)
      setSaved(JSON.stringify({ enabled: result.enabled, config: result.config }))
      toast.success('Voice AI saved.')
    }))

  const toggleLive = (next: boolean) => {
    if (next && props.mode === 'service' && !props.assistant) {
      toast.error('Pick an assistant for Voice AI first.')
      return
    }
    setEnabled(next)
  }

  const live =
    props.mode === 'service'
      ? {
          href: `/speak/${encodeURIComponent(roomName)}`,
          content: (
            <PublicServiceShell businessName={props.businessName} service="speak" links={{}} embedded>
              <SpeakRoom
                roomName={roomName}
                agentName={props.assistant?.name ?? 'Assistant'}
                businessName={props.businessName}
                firstMessage={voice.firstMessage || `Hi! I'm ${props.assistant?.name ?? 'your assistant'}. How can I help you today?`}
                config={config}
                socialAccounts={props.socialAccounts}
              />
            </PublicServiceShell>
          ),
        }
      : undefined

  return (
    <ServiceStudio
      name={isAssistant ? `${props.assistant?.name} · Voice` : 'Voice AI'}
      icon={AudioLines}
      tagline={isAssistant ? 'How this assistant handles calls: pace, persona, call length. The orb lives in Services → Voice AI.' : undefined}
      status={
        isAssistant
          ? { live: initial.enabled, label: initial.enabled ? 'Running Voice AI' : 'Not in use' }
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
          : { service: 'speak', notice: enabled ? null : 'Voice AI is off. Turn it on and save so your site can use it.' }
      }
    >
      {props.mode === 'service' ? (
        <ServiceAssistantPicker service="voice" assistants={props.assistants} currentId={props.assistant?.id ?? null} />
      ) : null}

      {props.mode === 'assistant' ? (
      <>
      <StudioSection
        id="voice"
        icon={Gauge}
        title="Voice"
        description="Which voice speaks and how fast. The first line and language are in this assistant's Prompt card."
        summary={[
          { label: 'voice', value: props.voiceLabel },
          { label: 'pace', value: label(SPEAKING_SPEEDS, config.speakingSpeed) },
          { label: 'language', value: voice.language === 'bn' ? 'Bangla' : 'English' },
        ]}
      >
        <Field label="Voice" hint="Account-wide, shared by all your assistants.">
          <Link
            href="/ai-agents/config#ai-engine"
            className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input px-3 text-sm hover:bg-muted/60"
          >
            <span className="truncate">{props.voiceLabel}</span>
            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <Settings2 className="h-3.5 w-3.5" />
              Change
            </span>
          </Link>
        </Field>
        <Field label="Speaking speed" hint="Applies to Cartesia, ElevenLabs, Fish Audio, OpenAI and Deepgram voices; Gemini voices get it as a pace hint.">
          <Segmented
            ariaLabel="Speaking speed"
            value={config.speakingSpeed}
            options={SPEAKING_SPEEDS.map(({ id, label: text }) => ({ id, label: text }))}
            onChange={(speakingSpeed) => patch({ speakingSpeed })}
          />
        </Field>
        {voice.language === 'bn' && !props.voiceSpeaksBangla ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
            Bangla understanding works, but the current voice is English-only. Pick a Fish Audio voice in AI Agents → Config for
            spoken Bangla.
          </p>
        ) : null}
      </StudioSection>

      <StudioSection
        id="persona"
        icon={Sparkles}
        accent="sky"
        title="Persona"
        description="How the voice AI sounds on calls. Short turns feel most natural on the phone."
        summary={[
          { label: 'name', value: config.assistantName || 'from the agent prompt' },
          { label: 'tone', value: label(TONES, config.tone) },
          { label: 'turn length', value: label(REPLY_LENGTHS, config.replyLength) },
        ]}
      >
        <Field
          label="Introduces itself as"
          htmlFor="speak-name"
          hint="Optional. Empty lets the assistant's prompt decide."
          counter={`${config.assistantName.length}/${SERVICE_LIMITS.assistantName}`}
        >
          <Input
            id="speak-name"
            value={config.assistantName}
            maxLength={SERVICE_LIMITS.assistantName}
            placeholder="e.g. Maya from Primeone"
            onChange={(e) => patch({ assistantName: e.target.value })}
          />
        </Field>
        <Field label="Tone">
          <ChoiceCards ariaLabel="Tone" value={config.tone} options={TONES} onChange={(tone) => patch({ tone })} />
        </Field>
        <Field label="Turn length" hint={REPLY_LENGTHS.find((item) => item.id === config.replyLength)?.hint}>
          <Segmented
            ariaLabel="Turn length"
            value={config.replyLength}
            options={REPLY_LENGTHS.map(({ id, label: text }) => ({ id, label: text }))}
            onChange={(replyLength) => patch({ replyLength })}
          />
        </Field>
      </StudioSection>

      <StudioSection
        id="call"
        icon={Timer}
        accent="amber"
        title="Call"
        description="How long calls can run, the heads-up before they end, and a way to reach a person."
        summary={[
          { label: 'max length', value: `${config.maxCallMinutes} min` },
          { label: 'warning', value: config.endWarningSeconds ? `${config.endWarningSeconds}s before` : 'off' },
          { label: 'human handoff', value: config.showHumanHandoff ? 'on' : 'off' },
        ]}
      >
        <Field label="Max call length" hint="The call ends on its own at this point. Daily call caps per business still apply.">
          <Segmented
            ariaLabel="Max call length"
            value={config.maxCallMinutes}
            options={(CALL_LENGTHS.includes(config.maxCallMinutes as (typeof CALL_LENGTHS)[number])
              ? CALL_LENGTHS
              : [...CALL_LENGTHS, config.maxCallMinutes].sort((a, b) => a - b)
            ).map((minutes) => ({ id: minutes, label: `${minutes} min` }))}
            onChange={(maxCallMinutes) => patch({ maxCallMinutes })}
          />
        </Field>
        <Field label="Warn before the call ends">
          <Segmented
            ariaLabel="Warn before the call ends"
            value={config.endWarningSeconds}
            options={END_WARNINGS.map((seconds) => ({ id: seconds, label: seconds ? `${seconds}s before` : 'No warning' }))}
            onChange={(endWarningSeconds) => patch({ endWarningSeconds })}
          />
        </Field>
        <ToggleRow
          label="Talk to a person"
          hint="Show your WhatsApp, Messenger or phone next to the call button (from Business → Social)."
          checked={config.showHumanHandoff}
          onChange={(showHumanHandoff) => patch({ showHumanHandoff })}
        />
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
        <Field label="Orb colours">
          <div role="radiogroup" aria-label="Orb colours" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(WIZARD_THEMES) as WizardThemeId[]).map((themeId) => {
              const theme = WIZARD_THEMES[themeId]
              const selected = config.orbTheme === themeId
              return (
                <button
                  key={themeId}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => patch({ orbTheme: themeId })}
                  className={
                    selected
                      ? 'flex items-center gap-2 rounded-xl border border-primary bg-primary/10 p-2 text-left text-sm'
                      : 'flex items-center gap-2 rounded-xl border border-border p-2 text-left text-sm hover:bg-muted/50'
                  }
                >
                  <span className="h-7 w-7 shrink-0 rounded-full border border-border" style={{ background: theme.colorBack }}>
                    <WizardGem theme={themeId} shape="circle" size={28} />
                  </span>
                  {theme.label}
                </button>
              )
            })}
          </div>
        </Field>
        <Field label="Orb shape">
          <Segmented ariaLabel="Orb shape" value={config.orbShape} options={WIZARD_SHAPES} onChange={(orbShape) => patch({ orbShape })} />
        </Field>
        <Field label="Call button label" htmlFor="speak-button" counter={`${config.callButtonLabel.length}/${SERVICE_LIMITS.buttonLabel}`}>
          <Input
            id="speak-button"
            value={config.callButtonLabel}
            maxLength={SERVICE_LIMITS.buttonLabel}
            onChange={(e) => patch({ callButtonLabel: e.target.value })}
            className="max-w-xs"
          />
        </Field>
      </StudioSection>
      ) : null}

      {isAssistant ? (
        <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <PhoneCall className="h-3.5 w-3.5" aria-hidden />
          Pace, persona and call settings apply to new calls as soon as you save.
        </p>
      ) : null}
    </ServiceStudio>
  )
}
