'use client'
import { updateAssistant } from '@/actions/vapi'
import { updateLiveKitAgent } from '@/actions/livekitAgent'
import {
  listFishVoices,
  type FishVoiceLanguageFilter,
  type FishVoiceOption,
} from '@/actions/fishVoices'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAiAgentStore } from '@/store/useAiAgentstore'
import type { Assistant } from '@vapi-ai/server-sdk/api'
import { Check, ChevronsUpDown, Info, Loader2 } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { DEFAULT_LLM_MODEL } from '@/lib/llm/defaultModel'
import {
  defaultModelForLlmProvider,
  LLM_MODEL_GROUPS,
  type LlmModelProvider,
} from '@/lib/llm/modelOptions'

const LIVEKIT_LLM_PROVIDERS: { value: LlmModelProvider; label: string }[] = [
  { value: 'google', label: 'Google Gemini' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'kimi', label: 'Kimi' },
  { value: 'openai', label: 'OpenAI (Phase 2)' },
  { value: 'anthropic', label: 'Claude (Phase 2)' },
]

const DEEPGRAM_VOICES = [
  { id: 'aura-asteria-en', label: 'Aura Asteria (EN)' },
  { id: 'aura-luna-en', label: 'Aura Luna (EN)' },
  { id: 'aura-stella-en', label: 'Aura Stella (EN)' },
  { id: 'aura-athena-en', label: 'Aura Athena (EN)' },
  { id: 'aura-hera-en', label: 'Aura Hera (EN)' },
  { id: 'aura-orion-en', label: 'Aura Orion (EN)' },
  { id: 'aura-arcas-en', label: 'Aura Arcas (EN)' },
  { id: 'aura-perseus-en', label: 'Aura Perseus (EN)' },
  { id: 'aura-angus-en', label: 'Aura Angus (EN)' },
  { id: 'aura-orpheus-en', label: 'Aura Orpheus (EN)' },
  { id: 'aura-helios-en', label: 'Aura Helios (EN)' },
  { id: 'aura-zeus-en', label: 'Aura Zeus (EN)' },
]

const ModelConfiguration = () => {
  const { assistant: selectedAssistant, livekitAgent, source } = useAiAgentStore()
  const assistant = selectedAssistant as Assistant | null
  const [firstMessage, setFirstMessage] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [llmProvider, setLlmProvider] = useState<LlmModelProvider>('google')
  const [llmModel, setLlmModel] = useState(DEFAULT_LLM_MODEL)
  const [voiceProvider, setVoiceProvider] = useState('deepgram')
  const [voiceModel, setVoiceModel] = useState('aura-asteria-en')
  const [loading, setLoading] = useState(false)

  const [fishVoices, setFishVoices] = useState<FishVoiceOption[]>([])
  const [fishLoading, setFishLoading] = useState(false)
  const [fishSearch, setFishSearch] = useState('')
  const [fishLanguage, setFishLanguage] = useState<FishVoiceLanguageFilter>('bn')
  const [fishPopoverOpen, setFishPopoverOpen] = useState(false)

  const livekitModels = useMemo(() => {
    const group = LLM_MODEL_GROUPS.find((g) =>
      g.items.some((i) => i.provider === llmProvider),
    )
    return group?.items.filter((i) => i.provider === llmProvider) ?? []
  }, [llmProvider])

  const selectedFishVoice = useMemo(
    () => fishVoices.find((v) => v.id === voiceModel) || null,
    [fishVoices, voiceModel],
  )

  const loadFishVoices = useCallback(
    async (search?: string, language?: FishVoiceLanguageFilter) => {
      setFishLoading(true)
      try {
        const res = await listFishVoices({
          search: search?.trim() || undefined,
          language: language || fishLanguage,
        })
        if (!res.success || !res.data) {
          toast.error(res.error || 'Failed to load Fish voices.')
          setFishVoices([])
          return
        }
        setFishVoices(res.data)
        setVoiceModel((current) => {
          if (current.trim()) return current
          return res.data?.[0]?.id || current
        })
      } catch {
        toast.error('Failed to load Fish voices.')
        setFishVoices([])
      } finally {
        setFishLoading(false)
      }
    },
    [fishLanguage],
  )

  useEffect(() => {
    if (source !== 'livekit' || voiceProvider !== 'fish') return
    void loadFishVoices(undefined, fishLanguage)
  }, [source, voiceProvider, fishLanguage, loadFishVoices])

  useEffect(() => {
    if (source !== 'livekit' || voiceProvider !== 'fish') return
    const handle = window.setTimeout(() => {
      void loadFishVoices(fishSearch, fishLanguage)
    }, 350)
    return () => window.clearTimeout(handle)
  }, [fishSearch, fishLanguage, source, voiceProvider, loadFishVoices])

  const handleSave = async () => {
    setLoading(true)
    try {
      if (source === 'vapi' && assistant) {
        const res = await updateAssistant(assistant.id as string, firstMessage, systemPrompt)
        if (!res.success) {
          throw new Error(res.message)
        }
        toast.success('Assistant updated successfully.')
      } else if (source === 'livekit' && livekitAgent) {
        if (voiceProvider === 'fish' && !voiceModel.trim()) {
          toast.error('Pick a Fish voice before saving.')
          return
        }
        const res = await updateLiveKitAgent(livekitAgent.id, {
          firstMessage,
          systemPrompt,
          llmProvider,
          llmModel,
          voiceProvider,
          voiceModel,
        })
        if (!res.success) {
          throw new Error(res.error || 'Failed to update LiveKit agent.')
        }
        toast.success('LiveKit agent updated successfully.')
      }
    } catch (error) {
      console.error('Error updating model configuration:', error)
      toast.error('Failed to update configuration. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (source === 'vapi' && assistant) {
      setFirstMessage(assistant.firstMessage || '')
      setSystemPrompt(assistant.model?.messages?.[0]?.content || '')
    } else if (source === 'livekit' && livekitAgent) {
      setFirstMessage(livekitAgent.firstMessage || '')
      setSystemPrompt(livekitAgent.systemPrompt || '')
      const provider = (livekitAgent.llmProvider || 'google') as LlmModelProvider
      setLlmProvider(provider)
      setLlmModel(livekitAgent.llmModel || DEFAULT_LLM_MODEL)
      setVoiceProvider(livekitAgent.voiceProvider || 'deepgram')
      setVoiceModel(livekitAgent.voiceModel || 'aura-asteria-en')
    }
  }, [assistant, livekitAgent, source])

  if (source === 'vapi' && !assistant) {
    return (
      <div className="flex justify-center items-center h-[500px] w-full">
        <div className=" bg-neutral-900 rounded-xl p-6 w-full">
          <p className="text-primary/80 text-center">
            No assistant selected. Please select an assistant to configure the model settings.
          </p>
        </div>
      </div>
    )
  }

  if (source === 'livekit' && !livekitAgent) {
    return (
      <div className="flex justify-center items-center h-[500px] w-full">
        <div className=" bg-neutral-900 rounded-xl p-6 w-full">
          <p className="text-primary/80 text-center">
            LiveKit agent configuration is not available.
          </p>
        </div>
      </div>
    )
  }

  const ownedFish = fishVoices.filter((v) => v.owned)
  const publicFish = fishVoices.filter((v) => !v.owned)

  return (
    <div className="bg-neutral-900 rounded-xl p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Model</h2>
        <Button
          onClick={handleSave}
          disabled={loading}
        >
          {loading? (
            <>
              <Loader2 className="animate-spin mr-2" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
      <p className="text-neutral-400 mb-6" >
        Configure the behavior of the assistant.
      </p>
      <div className="mb-6" >
        <div className="flex items-center mb-2">
          <label className="font-medium">First Message</label>
          <Info className="h-4 w-4 text-neutral-500 ml-2" />
        </div>
        <Input
          value={firstMessage}
          onChange={(e) => setFirstMessage(e.target.value)}
          className="bg-primary/10 border-input"
        />
      </div>

      <div className="mb-6" >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <label className="font-medium">System Prompt</label>
            <Info className="h-4 w-4 text-neutral-500 ml-2" />
          </div>
        </div>
        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          className="bg-primary/10 border-input h-[220px] md:h-[260px] lg:h-[300px] resize-y"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="text-sm text-neutral-300 mb-2 block">LLM Provider</label>
          <Select
            value={source === 'livekit' ? llmProvider : assistant?.model?.provider || ''}
            onValueChange={(v) => {
              const next = v as LlmModelProvider
              setLlmProvider(next)
              setLlmModel(defaultModelForLlmProvider(next))
            }}
            disabled={source !== 'livekit'}
          >
            <SelectTrigger className="bg-primary/10 border-input">
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              {LIVEKIT_LLM_PROVIDERS.map((p) => (
                <SelectItem
                  key={p.value}
                  value={p.value}
                  disabled={p.value === 'openai' || p.value === 'anthropic'}
                >
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-neutral-300 mb-2 block">LLM Model</label>
          {source === 'livekit' && livekitModels.length > 0 ? (
            <Select value={llmModel} onValueChange={setLlmModel}>
              <SelectTrigger className="bg-primary/10 border-input">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {livekitModels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={source === 'livekit' ? llmModel : assistant?.model?.model || ''}
              onChange={(e) => setLlmModel(e.target.value)}
              className="bg-primary/10 border-input"
              disabled={source !== 'livekit'}
            />
          )}
        </div>
        <div>
          <label className="text-sm text-neutral-300 mb-2 block">Voice Provider</label>
          <Select
            value={voiceProvider}
            onValueChange={(v) => {
              setVoiceProvider(v)
              if (v === 'fish') {
                if (voiceModel.startsWith('aura-')) setVoiceModel('')
              } else if (v === 'deepgram') {
                setVoiceModel('aura-asteria-en')
              }
            }}
            disabled={source !== 'livekit'}
          >
            <SelectTrigger className="bg-primary/10 border-input">
              <SelectValue placeholder="Select voice provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deepgram">Deepgram</SelectItem>
              <SelectItem value="fish">Fish Audio</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-neutral-300 mb-2 block">
            {voiceProvider === 'fish' ? 'Fish Voice' : 'Voice Model'}
          </label>

          {source === 'livekit' && voiceProvider === 'fish' ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Select
                  value={fishLanguage}
                  onValueChange={(v) => setFishLanguage(v as FishVoiceLanguageFilter)}
                >
                  <SelectTrigger className="h-10 w-[4.5rem] shrink-0 bg-primary/10 border-input px-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bn">bn</SelectItem>
                    <SelectItem value="en">en</SelectItem>
                    <SelectItem value="all">all</SelectItem>
                  </SelectContent>
                </Select>
                <Popover open={fishPopoverOpen} onOpenChange={setFishPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={fishPopoverOpen}
                      className="min-w-0 flex-1 justify-between bg-primary/10 border-input font-normal"
                      disabled={fishLoading && fishVoices.length === 0}
                    >
                      <span className="truncate text-left">
                        {selectedFishVoice
                          ? `${selectedFishVoice.title}${selectedFishVoice.owned ? ' (yours)' : ''}`
                          : voiceModel.trim()
                            ? voiceModel
                            : fishLoading
                              ? 'Loading Fish voices…'
                              : 'Select a Fish voice'}
                      </span>
                      <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="p-0 w-[min(28rem,calc(100vw-2rem))]"
                    align="start"
                  >
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder={
                          fishLanguage === 'bn'
                            ? 'Search Bangla voices…'
                            : 'Search Fish voices…'
                        }
                        value={fishSearch}
                        onValueChange={setFishSearch}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {fishLoading
                            ? 'Loading…'
                            : fishLanguage === 'bn'
                              ? 'No Bangla-tagged voices found. Try all, or clone a Bangla voice on fish.audio.'
                              : 'No voices found. Save a Fish API key in Config Agent.'}
                        </CommandEmpty>
                        {ownedFish.length > 0 ? (
                          <CommandGroup heading="Your voices">
                            {ownedFish.map((v) => (
                              <CommandItem
                                key={v.id}
                                value={`${v.id} ${v.title}`}
                                onSelect={() => {
                                  setVoiceModel(v.id)
                                  setFishPopoverOpen(false)
                                }}
                              >
                                <Check
                                  className={cn(
                                    'size-4 shrink-0',
                                    voiceModel === v.id ? 'opacity-100' : 'opacity-0',
                                  )}
                                />
                                <span className="flex flex-col gap-0.5 min-w-0">
                                  <span className="truncate">{v.title}</span>
                                  <span className="text-xs text-muted-foreground font-mono truncate">
                                    {v.id}
                                  </span>
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        ) : null}
                        {publicFish.length > 0 ? (
                          <CommandGroup heading="Public voices">
                            {publicFish.map((v) => (
                              <CommandItem
                                key={v.id}
                                value={`${v.id} ${v.title}`}
                                onSelect={() => {
                                  setVoiceModel(v.id)
                                  setFishPopoverOpen(false)
                                }}
                              >
                                <Check
                                  className={cn(
                                    'size-4 shrink-0',
                                    voiceModel === v.id ? 'opacity-100' : 'opacity-0',
                                  )}
                                />
                                <span className="flex flex-col gap-0.5 min-w-0">
                                  <span className="truncate">{v.title}</span>
                                  <span className="text-xs text-muted-foreground font-mono truncate">
                                    {v.id}
                                    {v.languages.length ? ` · ${v.languages.join(', ')}` : ''}
                                  </span>
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        ) : null}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <p className="text-xs text-neutral-500">
                Uses{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                  s2.1-pro-free
                </code>
                . Fish can speak Bangla on most voices; pick a Bangla-tagged voice
                for better accent, or clone one on fish.audio.
              </p>
              <p className="text-xs text-neutral-500">
                Selected reference_id:{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                  {voiceModel.trim() || '—'}
                </code>
              </p>
            </div>
          ) : source === 'livekit' ? (
            <Select value={voiceModel} onValueChange={setVoiceModel}>
              <SelectTrigger className="bg-primary/10 border-input">
                <SelectValue placeholder="Select Deepgram voice" />
              </SelectTrigger>
              <SelectContent>
                {DEEPGRAM_VOICES.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={voiceModel}
              onChange={(e) => setVoiceModel(e.target.value)}
              className="bg-primary/10 border-input"
              disabled
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default ModelConfiguration
