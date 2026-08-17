'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  getVoiceCredentials,
  saveVoiceCredentials,
  validateVoiceCredential,
} from '@/actions/voiceCredentials'
import {
  CONFIG_PROVIDERS,
  type ConfigCredentialProvider,
  type ConfigProviderItem,
} from '@/lib/usage/configProviders'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type KeySource = 'database' | 'env' | 'none'

type ProviderStatus = {
  hasKey: boolean
  masked: string | null
  source: KeySource
}

const EMPTY_STATUS: Record<ConfigCredentialProvider, ProviderStatus> = {
  google: { hasKey: false, masked: null, source: 'none' },
  openai: { hasKey: false, masked: null, source: 'none' },
  anthropic: { hasKey: false, masked: null, source: 'none' },
  deepseek: { hasKey: false, masked: null, source: 'none' },
  kimi: { hasKey: false, masked: null, source: 'none' },
  deepgram: { hasKey: false, masked: null, source: 'none' },
  fish: { hasKey: false, masked: null, source: 'none' },
}

const SAVE_FIELD: Record<
  ConfigCredentialProvider,
  | 'googleApiKey'
  | 'openaiApiKey'
  | 'anthropicApiKey'
  | 'deepseekApiKey'
  | 'kimiApiKey'
  | 'deepgramApiKey'
  | 'fishApiKey'
> = {
  google: 'googleApiKey',
  openai: 'openaiApiKey',
  anthropic: 'anthropicApiKey',
  deepseek: 'deepseekApiKey',
  kimi: 'kimiApiKey',
  deepgram: 'deepgramApiKey',
  fish: 'fishApiKey',
}

function kindBadge(kind: ConfigProviderItem['kind']): string {
  if (kind === 'stt') return 'STT'
  if (kind === 'tts') return 'TTS'
  return 'LLM'
}

function sourceLabel(source: KeySource): string {
  if (source === 'database') return 'Saved in Config Agent'
  if (source === 'env') return 'Using .env fallback'
  return 'Not configured'
}

export default function ConfigProviderSidebar() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState<ConfigCredentialProvider>('google')
  const [status, setStatus] =
    useState<Record<ConfigCredentialProvider, ProviderStatus>>(EMPTY_STATUS)
  const [dialogProvider, setDialogProvider] = useState<ConfigProviderItem | null>(
    null,
  )
  const [keyValue, setKeyValue] = useState('')
  const [saving, setSaving] = useState(false)

  const loadStatus = useCallback(async () => {
    const res = await getVoiceCredentials()
    if (!res.success || !res.data) return
    const d = res.data
    setStatus({
      google: {
        hasKey: d.hasGoogleApiKey,
        masked: d.maskedGoogleApiKey,
        source: d.googleKeySource,
      },
      openai: {
        hasKey: d.hasOpenAiApiKey,
        masked: d.maskedOpenAiApiKey,
        source: d.openaiKeySource,
      },
      anthropic: {
        hasKey: d.hasAnthropicApiKey,
        masked: d.maskedAnthropicApiKey,
        source: d.anthropicKeySource,
      },
      deepseek: {
        hasKey: d.hasDeepseekApiKey,
        masked: d.maskedDeepseekApiKey,
        source: d.deepseekKeySource,
      },
      kimi: {
        hasKey: d.hasKimiApiKey,
        masked: d.maskedKimiApiKey,
        source: d.kimiKeySource,
      },
      deepgram: {
        hasKey: d.hasDeepgramApiKey,
        masked: d.maskedDeepgramApiKey,
        source: d.deepgramKeySource,
      },
      fish: {
        hasKey: d.hasFishApiKey,
        masked: d.maskedFishApiKey,
        source: d.fishKeySource,
      },
    })
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return CONFIG_PROVIDERS
    return CONFIG_PROVIDERS.filter((item) => {
      const hay = `${item.name} ${item.kind} ${kindBadge(item.kind)}`.toLowerCase()
      return hay.includes(q)
    })
  }, [searchQuery])

  const openConfig = (item: ConfigProviderItem) => {
    setSelectedId(item.id)
    setDialogProvider(item)
    setKeyValue('')
  }

  const handleSave = async () => {
    if (!dialogProvider) return
    const trimmed = keyValue.trim()
    if (!trimmed) {
      toast.error('Paste an API key first.')
      return
    }
    setSaving(true)
    try {
      const saveRes = await saveVoiceCredentials({
        [SAVE_FIELD[dialogProvider.id]]: trimmed,
      })
      if (!saveRes.success) {
        throw new Error(saveRes.error || 'Failed to save key')
      }
      const check = await validateVoiceCredential(dialogProvider.id)
      if (check.success && check.valid) {
        toast.success(`${dialogProvider.name} key saved and verified.`)
      } else {
        toast.success(`${dialogProvider.name} key saved.`)
        if (check.error) toast.error(check.error)
      }
      setDialogProvider(null)
      setKeyValue('')
      await loadStatus()
    } catch {
      toast.error('Failed to save API key. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 w-[300px] shrink-0 flex-col overflow-hidden border-r border-border">
      <div className="shrink-0 p-4">
        <Button
          className="w-full flex items-center gap-2 mb-4 cursor-pointer"
          variant="outline"
          onClick={() => router.push('/ai-agents')}
        >
          <ArrowLeft /> Back to agents
        </Button>
        <div className="relative">
          <Input
            placeholder="Search LLM, STT, TTS"
            className="bg-neutral-900 border-neutral-700 pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1 overflow-hidden px-2 pb-4">
        {filtered.map((item) => {
          const itemStatus = status[item.id]
          const selected = selectedId === item.id
          return (
            <div
              className={`group p-3 rounded-lg cursor-pointer mb-2 border transition-colors ${
                selected
                  ? 'bg-primary/20 border-primary/40'
                  : 'bg-primary/10 border-transparent hover:bg-primary/20 hover:border-primary/30'
              }`}
              key={item.id}
              onClick={() => setSelectedId(item.id)}
            >
              <div className="font-medium flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary/80 shrink-0">
                    {kindBadge(item.kind)}
                  </span>
                  <span className="truncate">{item.name}</span>
                </div>
                <button
                  type="button"
                  aria-label={`Configure ${item.name} API key`}
                  className="opacity-70 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation()
                    openConfig(item)
                  }}
                >
                  <Settings2 className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground truncate">
                {itemStatus.hasKey
                  ? sourceLabel(itemStatus.source)
                  : 'No API key'}
              </p>
            </div>
          )
        })}
      </ScrollArea>

      <Dialog
        open={!!dialogProvider}
        onOpenChange={(open) => {
          if (!open) {
            setDialogProvider(null)
            setKeyValue('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogProvider ? `${dialogProvider.name} API key` : 'API key'}
            </DialogTitle>
            <DialogDescription>
              {dialogProvider
                ? `This key is used account-wide for ${dialogProvider.name} (${kindBadge(dialogProvider.kind)}).`
                : 'Set a provider API key.'}
            </DialogDescription>
          </DialogHeader>
          {dialogProvider ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Current:{' '}
                {status[dialogProvider.id].masked || 'not configured'}
                {status[dialogProvider.id].hasKey
                  ? ` · ${sourceLabel(status[dialogProvider.id].source)}`
                  : ''}
              </p>
              <div className="space-y-2">
                <Label htmlFor="provider-api-key">New API key</Label>
                <Input
                  id="provider-api-key"
                  type="password"
                  autoComplete="off"
                  placeholder={dialogProvider.placeholder}
                  value={keyValue}
                  onChange={(e) => setKeyValue(e.target.value)}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDialogProvider(null)
                setKeyValue('')
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : 'Save key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
