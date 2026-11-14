'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { AudioLines, Mic, Palette, PhoneCall, Play, Settings2, Sparkles, Square, Timer } from 'lucide-react'
import { toast } from 'sonner'
import { saveSpeakService } from '@/actions/services'
import { ServiceStudio } from '@/components/services/studio/ServiceStudio'
import { ChoiceCards, Field, Segmented, StudioSection, ToggleRow } from '@/components/services/studio/StudioPrimitives'
import { WizardGem } from '@/components/wizard/WizardGem'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SERVICE_SNIPPETS } from '@/lib/services/snippets'
import {
  END_WARNINGS,
  REPLY_LENGTHS,
  SERVICE_LIMITS,
  TONES,
  type ServiceState,
  type SpeakServiceConfig,
} from '@/lib/services/types'
import { WIZARD_SHAPES, WIZARD_THEMES, resolveTheme, type WizardThemeId } from '@/lib/wizard/types'

type VoiceSettings = { language: 'en' | 'bn'; firstMessage: string }

const SECTIONS = [
  { id: 'voice', label: 'Voice' },
  { id: 'persona', label: 'Persona' },
  { id: 'call', label: 'Call' },
  { id: 'look', label: 'Look' },
]

const CALL_LENGTHS = [3, 5, 10, 15, 30] as const
const FIRST_LINE_MAX = 500
const label = <T extends string | number>(options: readonly { id: T; label: string }[], id: T) =>
  options.find((option) => option.id === id)?.label ?? String(id)

export function SpeakConfigurator({
  roomName,
  initial,
  initialVoice,
  voiceLabel,
  voiceSpeaksBangla,
}: {
  roomName: string
  initial: ServiceState<SpeakServiceConfig>
  initialVoice: VoiceSettings
  /** Account-wide voice from AI Agents → Config (read-only here). */
  voiceLabel: string
  /** Fish voices can speak Bangla; Deepgram Aura voices are English-only. */
  voiceSpeaksBangla: boolean
}) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [config, setConfig] = useState(initial.config)
  const [voice, setVoice] = useState(initialVoice)
  const [saved, setSaved] = useState(() => JSON.stringify({ enabled: initial.enabled, config: initial.config, voice: initialVoice }))
  const [isSaving, startSaving] = useTransition()
  const [speaking, setSpeaking] = useState(false)

  const dirty = JSON.stringify({ enabled, config, voice }) !== saved
  const savedEnabled = (JSON.parse(saved) as { enabled: boolean }).enabled
  const patch = (partial: Partial<SpeakServiceConfig>) => setConfig((current) => ({ ...current, ...partial }))
  const palette = resolveTheme(config.orbTheme)

  const save = () =>
    startSaving(async () => {
      const result = await saveSpeakService({ enabled, config, ...voice })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setConfig(result.config)
      setSaved(JSON.stringify({ enabled, config: result.config, voice }))
      toast.success('Speak AI saved. New calls use these settings.')
    })

  /** Quick local preview of the first line (browser voice); live calls use your AI engine's voice. */
  const previewFirstLine = () => {
    if (!('speechSynthesis' in window)) return
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const utterance = new SpeechSynthesisUtterance(voice.firstMessage || 'Hello!')
    utterance.lang = voice.language === 'bn' ? 'bn-BD' : 'en-US'
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  const preview = (
    <div
      className="flex min-h-[520px] flex-col items-center justify-center gap-5 p-6 text-center"
      style={{ backgroundColor: palette.colorBack, color: palette.isLight ? '#18181b' : '#fafafa' }}
    >
      <WizardGem theme={config.orbTheme} shape={config.orbShape} size={190} speaking={speaking} />
      <p className="max-w-xs text-sm opacity-80">{voice.firstMessage || 'Hello! How can I help?'}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <span
          className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium"
          style={{ backgroundColor: palette.isLight ? '#18181b' : '#fafafa', color: palette.isLight ? '#fafafa' : '#18181b' }}
        >
          <Mic className="h-4 w-4" aria-hidden />
          {config.callButtonLabel}
        </span>
        <button
          type="button"
          onClick={previewFirstLine}
          className="flex items-center gap-1.5 rounded-full border border-current/20 px-3 py-2 text-xs opacity-80 hover:opacity-100"
        >
          {speaking ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          Hear first line
        </button>
      </div>
      <p className="text-[11px] opacity-60">
        {voiceLabel} · {voice.language === 'bn' ? 'বাংলা' : 'English'} · up to {config.maxCallMinutes} min
      </p>
      <a
        href={`/speak/${encodeURIComponent(roomName)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs underline underline-offset-2 opacity-70 hover:opacity-100"
      >
        Test a live call
      </a>
    </div>
  )

  return (
    <ServiceStudio
      name="Speak AI"
      icon={AudioLines}
      tagline="Real-time voice calls with your business AI."
      status={{ live: savedEnabled, label: savedEnabled ? 'Live' : 'Off' }}
      toggle={{ label: 'On website', checked: enabled, onChange: setEnabled }}
      publicHref={`/speak/${encodeURIComponent(roomName)}`}
      dirty={dirty}
      saving={isSaving}
      onSave={save}
      sections={SECTIONS}
      preview={preview}
      previewTitle="speak · live preview"
      integrate={{
        serviceName: 'Speak AI',
        roomName,
        snippet: SERVICE_SNIPPETS.speak,
        snippetFile: 'components/CallButton.tsx',
        hostedHref: `/speak/${encodeURIComponent(roomName)}`,
        offNotice: enabled ? null : 'Speak AI is off. Turn it on and save, or the SDK and hosted page will refuse calls.',
      }}
    >
      <StudioSection
        id="voice"
        icon={AudioLines}
        title="Voice"
        description="The language the AI listens and speaks in, and its opening line."
        summary={[
          { label: 'language', value: voice.language === 'bn' ? 'Bangla' : 'English' },
          { label: 'voice', value: voiceLabel },
          { label: 'first line', value: voice.firstMessage || 'agent default' },
        ]}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Language">
            <Segmented
              ariaLabel="Language"
              value={voice.language}
              options={[
                { id: 'en', label: 'English' },
                { id: 'bn', label: 'বাংলা (Bangla)' },
              ]}
              onChange={(language) => setVoice((current) => ({ ...current, language }))}
            />
          </Field>
          <Field label="Voice" hint="Account-wide, shared by all your agents.">
            <Link
              href="/ai-agents/config#ai-engine"
              className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input px-3 text-sm hover:bg-muted/60"
            >
              <span className="truncate">{voiceLabel}</span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <Settings2 className="h-3.5 w-3.5" />
                Change
              </span>
            </Link>
          </Field>
        </div>
        {voice.language === 'bn' && !voiceSpeaksBangla ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
            Bangla understanding works, but the current voice is English-only. Pick a Fish Audio voice in AI Agents → Config for
            spoken Bangla.
          </p>
        ) : null}
        <Field label="First thing the AI says" htmlFor="speak-first" counter={`${voice.firstMessage.length}/${FIRST_LINE_MAX}`}>
          <Textarea
            id="speak-first"
            value={voice.firstMessage}
            maxLength={FIRST_LINE_MAX}
            onChange={(e) => setVoice((current) => ({ ...current, firstMessage: e.target.value }))}
            rows={2}
            placeholder="Hi! Thanks for calling. How can I help?"
          />
        </Field>
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
          hint="Optional. Empty lets your agent's prompt decide."
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

      <StudioSection
        id="look"
        icon={Palette}
        accent="rose"
        title="Look"
        description="The orb and call button on your hosted call page."
        summary={[
          { label: 'orb', value: `${WIZARD_THEMES[config.orbTheme].label} · ${label(WIZARD_SHAPES, config.orbShape)}` },
          { label: 'button', value: config.callButtonLabel },
        ]}
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

      <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
        <PhoneCall className="h-3.5 w-3.5" aria-hidden />
        Language, first line and persona apply to new calls as soon as you save.
      </p>
    </ServiceStudio>
  )
}
