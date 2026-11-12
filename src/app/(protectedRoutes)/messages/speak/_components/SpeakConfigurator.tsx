'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ExternalLink, Play, Settings2, Square } from 'lucide-react'
import { toast } from 'sonner'
import { saveSpeakService } from '@/actions/services'
import { ServiceConfigFrame } from '@/components/services/ServiceConfigFrame'
import { WizardGem } from '@/components/wizard/WizardGem'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SERVICE_SNIPPETS } from '@/lib/services/snippets'
import { SERVICE_LIMITS, type ServiceState, type SpeakServiceConfig } from '@/lib/services/types'
import { cn } from '@/lib/utils'

type VoiceSettings = { language: 'en' | 'bn'; firstMessage: string }

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

  const save = () =>
    startSaving(async () => {
      const result = await saveSpeakService({ enabled, config, ...voice })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setConfig(result.config)
      setSaved(JSON.stringify({ enabled, config: result.config, voice }))
      toast.success('Speak AI saved — new calls use these settings')
    })

  /** Quick local preview of the first line (browser voice); live calls use the selected Deepgram voice. */
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
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-[#05060f] p-6 text-center text-zinc-50">
      <WizardGem theme="aurora" shape="circle" size={180} speaking={speaking} />
      <p className="text-sm text-zinc-300">{voice.firstMessage || 'Hello! How can I help?'}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={previewFirstLine}
          className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs hover:bg-white/10"
        >
          {speaking ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          First line
        </button>
        <a
          href={`/chat/${encodeURIComponent(roomName)}?tab=voice`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-zinc-900"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Test a live call
        </a>
      </div>
      <p className="text-[11px] text-zinc-400">
        {voiceLabel} ·{' '}
        {voice.language === 'bn' ? 'বাংলা' : 'English'} · max {config.maxCallMinutes} min
      </p>
    </div>
  )

  return (
    <ServiceConfigFrame
      serviceName="Speak AI"
      roomName={roomName}
      enabled={enabled}
      onEnabledChange={setEnabled}
      dirty={dirty}
      saving={isSaving}
      onSave={save}
      preview={preview}
      snippet={SERVICE_SNIPPETS.speak}
    >
      <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-5">
        <h2 className="text-sm font-semibold">Voice</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Language</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['en', 'bn'] as const).map((language) => (
                <button
                  key={language}
                  type="button"
                  onClick={() => setVoice((current) => ({ ...current, language }))}
                  className={cn(
                    'h-9 rounded-md border text-sm',
                    voice.language === language ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/60',
                  )}
                >
                  {language === 'en' ? 'English' : 'বাংলা (Bangla)'}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Voice</Label>
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
          </div>
        </div>
        {voice.language === 'bn' && !voiceSpeaksBangla ? (
          <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
            Bangla understanding works, but the current voice is English-only. Pick a Fish Audio voice in Settings → AI
            engine for spoken Bangla.
          </p>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="speak-first">First thing the AI says</Label>
          <Textarea
            id="speak-first"
            value={voice.firstMessage}
            maxLength={500}
            onChange={(e) => setVoice((current) => ({ ...current, firstMessage: e.target.value }))}
            rows={2}
            placeholder="Hi! Thanks for calling. How can I help?"
          />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-5">
        <h2 className="text-sm font-semibold">Limits</h2>
        <div className="space-y-2">
          <Label htmlFor="speak-max">Max call length (minutes)</Label>
          <Input
            id="speak-max"
            type="number"
            min={SERVICE_LIMITS.maxCallMinutesMin}
            max={SERVICE_LIMITS.maxCallMinutesMax}
            value={config.maxCallMinutes}
            onChange={(e) => setConfig({ maxCallMinutes: Number(e.target.value) || SERVICE_LIMITS.maxCallMinutesMin })}
            className="max-w-[160px]"
          />
          <p className="text-xs text-muted-foreground">
            The SDK ends calls after this. Daily call caps per business still apply.
          </p>
        </div>
      </section>
    </ServiceConfigFrame>
  )
}
