'use client'

import React, { useCallback, useEffect, useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { getVoiceCredentials, saveVoiceCredentials, validateVoiceCredential } from '@/actions/voiceCredentials'
import { toast } from 'sonner'
import { AudioLines, Bot, Check, ChevronsUpDown, KeyRound, MessageSquare, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { labelForLlmModelId, LLM_MODEL_GROUPS, providerForLlmModelId } from '@/lib/llm/modelOptions'

type Provider = 'google' | 'openai' | 'anthropic' | 'deepgram'

type CheckResult = 'none' | 'ok' | 'error'

const ACTIVE_STORAGE_KEY = 'sts-ai.config.credential-active'
const LLM_STORAGE_KEY = 'sts-ai.config.llm-choice'
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'

type Props = {
  initialDefaultLlmModel: string
}

function sourceLabel(source: 'database' | 'env' | 'none'): string {
  if (source === 'database') return 'Saved in Config Agent'
  if (source === 'env') return 'Using .env fallback'
  return 'Not configured'
}

function providerMeta(provider: Provider): { label: string; Icon: typeof Sparkles; placeholder: string } {
  switch (provider) {
    case 'google':
      return { label: 'Gemini', Icon: Sparkles, placeholder: 'AIza…' }
    case 'openai':
      return { label: 'OpenAI', Icon: Bot, placeholder: 'sk-…' }
    case 'anthropic':
      return { label: 'Claude', Icon: MessageSquare, placeholder: 'sk-ant-…' }
    default:
      return { label: 'Deepgram', Icon: AudioLines, placeholder: 'Deepgram API key…' }
  }
}

function cardClass(result: CheckResult, active: boolean): string {
  if (!active || result === 'none') {
    return 'border-border bg-card'
  }
  if (result === 'ok') {
    return 'border-green-600/60 bg-green-500/5 dark:bg-green-500/10'
  }
  return 'border-red-600/60 bg-red-500/5 dark:bg-red-500/10'
}

const GlobalCredentialsConfig = ({ initialDefaultLlmModel }: Props) => {
  const [geminiKey, setGeminiKey] = useState('')
  const [openAiKey, setOpenAiKey] = useState('')
  const [claudeKey, setClaudeKey] = useState('')
  const [deepgramKey, setDeepgramKey] = useState('')
  const [hasGeminiKey, setHasGeminiKey] = useState(false)
  const [hasOpenAiKey, setHasOpenAiKey] = useState(false)
  const [hasClaudeKey, setHasClaudeKey] = useState(false)
  const [hasDeepgramKey, setHasDeepgramKey] = useState(false)
  const [googleKeySource, setGoogleKeySource] = useState<'database' | 'env' | 'none'>('none')
  const [openaiKeySource, setOpenaiKeySource] = useState<'database' | 'env' | 'none'>('none')
  const [claudeKeySource, setClaudeKeySource] = useState<'database' | 'env' | 'none'>('none')
  const [deepgramKeySource, setDeepgramKeySource] = useState<'database' | 'env' | 'none'>('none')
  const [loadingCreds, setLoadingCreds] = useState(false)
  const [savingCredentials, setSavingCredentials] = useState(false)
  const [validatingProvider, setValidatingProvider] = useState<null | Provider>(null)

  const [llmChoice, setLlmChoice] = useState(initialDefaultLlmModel)
  const [llmPopoverOpen, setLlmPopoverOpen] = useState(false)
  const [activeByProvider, setActiveByProvider] = useState<Record<Provider, boolean>>({
    google: false,
    openai: false,
    anthropic: false,
    deepgram: false,
  })
  const [resultByProvider, setResultByProvider] = useState<Record<Provider, CheckResult>>({
    google: 'none',
    openai: 'none',
    anthropic: 'none',
    deepgram: 'none',
  })

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACTIVE_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Record<Provider, boolean>>
        setActiveByProvider((prev) => ({
          google: parsed.google ?? prev.google,
          openai: parsed.openai ?? prev.openai,
          anthropic: parsed.anthropic ?? prev.anthropic,
          deepgram: parsed.deepgram ?? prev.deepgram,
        }))
      }
    } catch {
      /* ignore */
    }
    try {
      const storedLlm = localStorage.getItem(LLM_STORAGE_KEY)?.trim()
      if (storedLlm) setLlmChoice(storedLlm)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(activeByProvider))
    } catch {
      /* ignore */
    }
  }, [activeByProvider])

  useEffect(() => {
    try {
      localStorage.setItem(LLM_STORAGE_KEY, llmChoice.trim())
    } catch {
      /* ignore */
    }
  }, [llmChoice])

  useEffect(() => {
    // Default lock: when Gemini is active and OpenAI/Claude are inactive,
    // keep default model on Gemini family.
    if (activeByProvider.google && !activeByProvider.openai && !activeByProvider.anthropic) {
      const currentProvider = providerForLlmModelId(llmChoice)
      if (currentProvider && currentProvider !== 'google') {
        setLlmChoice(DEFAULT_GEMINI_MODEL)
      }
    }
  }, [activeByProvider, llmChoice])

  const loadCredentials = useCallback(async () => {
    setLoadingCreds(true)
    try {
      const res = await getVoiceCredentials()
      if (!res.success || !res.data) {
        setHasGeminiKey(false)
        setHasOpenAiKey(false)
        setHasClaudeKey(false)
        setHasDeepgramKey(false)
        setGoogleKeySource('none')
        setOpenaiKeySource('none')
        setClaudeKeySource('none')
        setDeepgramKeySource('none')
        setGeminiKey('')
        setOpenAiKey('')
        setClaudeKey('')
        setDeepgramKey('')
        return
      }
      setHasGeminiKey(res.data.hasGoogleApiKey)
      setHasOpenAiKey(res.data.hasOpenAiApiKey)
      setHasClaudeKey(res.data.hasAnthropicApiKey)
      setHasDeepgramKey(res.data.hasDeepgramApiKey)
      setGoogleKeySource(res.data.googleKeySource)
      setOpenaiKeySource(res.data.openaiKeySource)
      setClaudeKeySource(res.data.anthropicKeySource)
      setDeepgramKeySource(res.data.deepgramKeySource)
      setGeminiKey(res.data.maskedGoogleApiKey || '')
      setOpenAiKey(res.data.maskedOpenAiApiKey || '')
      setClaudeKey(res.data.maskedAnthropicApiKey || '')
      setDeepgramKey(res.data.maskedDeepgramApiKey || '')
    } catch {
      setHasGeminiKey(false)
      setHasOpenAiKey(false)
      setHasClaudeKey(false)
      setHasDeepgramKey(false)
      setGoogleKeySource('none')
      setOpenaiKeySource('none')
      setClaudeKeySource('none')
      setDeepgramKeySource('none')
      setGeminiKey('')
      setOpenAiKey('')
      setClaudeKey('')
      setDeepgramKey('')
    } finally {
      setLoadingCreds(false)
    }
  }, [])

  useEffect(() => {
    void loadCredentials()
  }, [loadCredentials])

  const handleSaveCredentials = async () => {
    setSavingCredentials(true)
    try {
      const res = await saveVoiceCredentials({
        googleApiKey: geminiKey.includes('...') ? undefined : geminiKey,
        openaiApiKey: openAiKey.includes('...') ? undefined : openAiKey,
        anthropicApiKey: claudeKey.includes('...') ? undefined : claudeKey,
        deepgramApiKey: deepgramKey.includes('...') ? undefined : deepgramKey,
      })
      if (!res.success) throw new Error(res.error || 'Failed to save credentials')
      toast.success('Credentials saved.')
      setResultByProvider({ google: 'none', openai: 'none', anthropic: 'none', deepgram: 'none' })
      await loadCredentials()
    } catch {
      toast.error('Failed to save credentials.')
    } finally {
      setSavingCredentials(false)
    }
  }

  const handleValidateCredential = async (provider: Provider) => {
    if (!activeByProvider[provider]) return

    setValidatingProvider(provider)
    try {
      const res = await validateVoiceCredential(provider)
      const label = providerMeta(provider).label

      if (!res.success) {
        setResultByProvider((prev) => ({ ...prev, [provider]: 'error' }))
        toast.error(res.error || `${label} validation failed.`)
        await loadCredentials()
        return
      }

      if (res.valid) {
        setResultByProvider((prev) => ({ ...prev, [provider]: 'ok' }))
        toast.success(`${label} key is valid.`)
      } else {
        setResultByProvider((prev) => ({ ...prev, [provider]: 'error' }))
        toast.error(res.error || `${label} validation failed.`)
      }

      await loadCredentials()
    } catch (error) {
      const fallback = error instanceof Error ? error.message : 'Validation failed.'
      setResultByProvider((prev) => ({ ...prev, [provider]: 'error' }))
      toast.error(fallback)
    } finally {
      setValidatingProvider(null)
    }
  }

  const providers: Provider[] = ['google', 'openai', 'anthropic', 'deepgram']

  return (
    <div className="flex flex-col gap-8">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <KeyRound className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          Config Agent
        </div>
        <p className="text-sm text-muted-foreground">
          Store API keys once. They apply to your agents and chat when the room owner matches your account.
        </p>
      </header>

      <section
        className={cn(
          'w-full rounded-xl border p-5 transition-colors',
          cardClass('none', true),
        )}
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-medium">Default model (LLM_CHOICE)</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Used as the fallback model ID in the app when an agent has no model set. Set{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">LLM_CHOICE</code> or{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">NEXT_PUBLIC_DEFAULT_LLM_MODEL</code>{' '}
              in <code className="rounded bg-muted px-1 py-0.5 text-[11px]">.env</code> for production; this field
              remembers your choice in this browser.
            </p>
          </div>
        </div>
        <div className="mt-4 w-full max-w-md">
          <Label className="text-xs text-muted-foreground mb-2 block">Model</Label>
          <Popover open={llmPopoverOpen} onOpenChange={setLlmPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={llmPopoverOpen}
                className="w-full justify-between font-mono text-sm font-normal"
              >
                <span className="truncate text-left">
                  {labelForLlmModelId(llmChoice)}
                  <span className="ml-2 text-muted-foreground text-xs">({llmChoice.trim() || '—'})</span>
                </span>
                <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="p-0 w-[min(28rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)]"
              align="start"
            >
              <Command>
                <CommandInput placeholder="Search models…" className="h-9" />
                <CommandList>
                  <CommandEmpty>No model found.</CommandEmpty>
                  {LLM_MODEL_GROUPS.map((g) => (
                    <CommandGroup key={g.group} heading={g.group}>
                      {g.items.map((item) => (
                        (() => {
                          const providerActive =
                            item.provider === 'google'
                              ? activeByProvider.google
                              : item.provider === 'openai'
                                ? activeByProvider.openai
                                : activeByProvider.anthropic
                          const isDisabled = !providerActive
                          return (
                        <CommandItem
                          key={item.id}
                          value={`${item.id} ${item.label}`}
                          disabled={isDisabled}
                          onSelect={() => {
                            if (isDisabled) {
                              toast.message(`${item.label} is locked. Activate ${item.provider === 'google' ? 'Gemini' : item.provider === 'openai' ? 'OpenAI' : 'Claude'} first.`)
                              return
                            }
                            setLlmChoice(item.id)
                            setLlmPopoverOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              'size-4 shrink-0',
                              llmChoice.trim() === item.id ? 'opacity-100' : 'opacity-0',
                            )}
                            aria-hidden
                          />
                          <span className="flex flex-col gap-0.5">
                            <span className={isDisabled ? 'text-muted-foreground' : ''}>{item.label}</span>
                            <span className="text-xs text-muted-foreground font-mono">{item.id}</span>
                          </span>
                        </CommandItem>
                          )
                        })()
                      ))}
                    </CommandGroup>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </section>

      <div className="flex flex-col gap-6">
        {providers.map((provider) => {
          const { label, Icon, placeholder } = providerMeta(provider)
          const active = activeByProvider[provider]
          const result = resultByProvider[provider]
          const value =
            provider === 'google'
              ? geminiKey
              : provider === 'openai'
                ? openAiKey
                : provider === 'anthropic'
                  ? claudeKey
                  : deepgramKey
          const setValue =
            provider === 'google'
              ? setGeminiKey
              : provider === 'openai'
                ? setOpenAiKey
                : provider === 'anthropic'
                  ? setClaudeKey
                  : setDeepgramKey
          const source =
            provider === 'google'
              ? googleKeySource
              : provider === 'openai'
                ? openaiKeySource
                : provider === 'anthropic'
                  ? claudeKeySource
                  : deepgramKeySource

          return (
            <section
              key={provider}
              className={cn(
                'w-full rounded-xl border p-5 transition-colors',
                cardClass(active ? result : 'none', active),
              )}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3 min-w-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
                    <Icon className="size-5 text-muted-foreground" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{label}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{sourceLabel(source)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <Label htmlFor={`key-${provider}`} className="sr-only">
                  {label} API key
                </Label>
                <Input
                  id={`key-${provider}`}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={placeholder}
                  className="font-mono text-sm"
                  autoComplete="off"
                />
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Switch
                    id={`active-${provider}`}
                    checked={active}
                    onCheckedChange={(checked) =>
                      setActiveByProvider((prev) => ({
                        ...prev,
                        [provider]: checked,
                      }))
                    }
                    aria-label={`${label} validation active`}
                  />
                  <Label htmlFor={`active-${provider}`} className="text-sm font-medium cursor-pointer">
                    Active
                  </Label>
                  <span className="text-xs text-muted-foreground">Validation runs only when Active is on.</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={validatingProvider === provider || !active}
                  onClick={() => void handleValidateCredential(provider)}
                  className="w-full sm:w-auto shrink-0"
                >
                  {validatingProvider === provider ? 'Checking…' : 'Validate'}
                </Button>
              </div>

              {active && result !== 'none' ? (
                <p
                  className={cn(
                    'mt-3 text-xs font-medium',
                    result === 'ok' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400',
                  )}
                  role="status"
                >
                  {result === 'ok' ? 'Check passed — key is valid.' : 'Check failed — fix the key or quota and try again.'}
                </p>
              ) : null}
            </section>
          )
        })}
      </div>

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-end pt-2">
        <Button onClick={handleSaveCredentials} disabled={savingCredentials || loadingCreds} className="w-full sm:w-auto">
          {savingCredentials ? 'Saving…' : 'Save credentials'}
        </Button>
      </div>

      {!hasGeminiKey && !hasOpenAiKey && !hasClaudeKey && !hasDeepgramKey ? (
        <p className="text-xs text-muted-foreground text-center">
          No keys saved yet. Paste keys above, save, then turn Active on and validate.
        </p>
      ) : null}
    </div>
  )
}

export default GlobalCredentialsConfig
