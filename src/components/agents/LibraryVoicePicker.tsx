'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { listProviderVoices } from '@/actions/providerVoices'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { LibraryVoice, LibraryVoiceProvider, VoiceLanguageFilter } from '@/lib/voices/voiceLibrary'
import { cn } from '@/lib/utils'

const SEARCH_DEBOUNCE_MS = 350

const PROVIDER_NAME: Record<LibraryVoiceProvider, string> = { cartesia: 'Cartesia', elevenlabs: 'ElevenLabs' }

/**
 * Searchable voice picker backed by the provider's live catalog on the creator's own key
 * (their cloned voices first). Value is the provider's voice id.
 */
export function LibraryVoicePicker({
  provider,
  value,
  valueLabel,
  onChange,
}: {
  provider: LibraryVoiceProvider
  value: string
  valueLabel?: string | null
  onChange: (voiceId: string, voiceTitle: string) => void
}) {
  const name = PROVIDER_NAME[provider]
  const [voices, setVoices] = useState<LibraryVoice[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [language, setLanguage] = useState<VoiceLanguageFilter>('en')
  const [open, setOpen] = useState(false)

  const load = useCallback(
    async (query: string, filter: VoiceLanguageFilter, signal: { stale: boolean }) => {
      setLoading(true)
      try {
        const result = await listProviderVoices({ provider, search: query, language: filter })
        if (signal.stale) return
        setVoices(result.ok ? result.voices : [])
        setError(result.ok ? null : result.error)
      } catch {
        if (!signal.stale) {
          setVoices([])
          setError(`Could not load ${name} voices.`)
        }
      } finally {
        if (!signal.stale) setLoading(false)
      }
    },
    [provider, name],
  )

  useEffect(() => {
    const signal = { stale: false }
    const handle = window.setTimeout(() => void load(search, language, signal), search ? SEARCH_DEBOUNCE_MS : 0)
    return () => {
      signal.stale = true
      window.clearTimeout(handle)
    }
  }, [search, language, load])

  const selected = useMemo(() => voices.find((voice) => voice.id === value) ?? null, [voices, value])
  const owned = voices.filter((voice) => voice.owned)
  const library = voices.filter((voice) => !voice.owned)

  const triggerLabel = selected
    ? `${selected.title}${selected.owned ? ' (yours)' : ''}`
    : valueLabel || (value ? value : loading ? `Loading ${name} voices…` : `Select a ${name} voice`)

  const renderVoice = (voice: LibraryVoice) => (
    <CommandItem
      key={voice.id}
      value={`${voice.id} ${voice.title}`}
      onSelect={() => {
        onChange(voice.id, voice.title)
        setOpen(false)
      }}
    >
      <Check className={cn('size-4 shrink-0', value === voice.id ? 'opacity-100' : 'opacity-0')} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate">{voice.title}</span>
        <span className="truncate text-xs text-muted-foreground">
          {[voice.languages.join(', '), voice.description].filter(Boolean).join(' · ') || voice.id}
        </span>
      </span>
    </CommandItem>
  )

  return (
    <div className="flex items-center gap-2">
      <Select value={language} onValueChange={(next) => setLanguage(next as VoiceLanguageFilter)}>
        <SelectTrigger aria-label="Voice language filter" className="h-9 w-[5.5rem] shrink-0 px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en">English</SelectItem>
          <SelectItem value="bn">বাংলা</SelectItem>
          <SelectItem value="all">All</SelectItem>
        </SelectContent>
      </Select>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={`${name} voice`}
            className="min-w-0 flex-1 justify-between font-normal"
          >
            <span className="truncate text-left">{triggerLabel}</span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(28rem,calc(100vw-2rem))] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={`Search ${name} voices…`} value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>{loading ? 'Loading…' : error || 'No voices match.'}</CommandEmpty>
              {owned.length > 0 ? <CommandGroup heading="Your voices">{owned.map(renderVoice)}</CommandGroup> : null}
              {library.length > 0 ? <CommandGroup heading={`${name} voices`}>{library.map(renderVoice)}</CommandGroup> : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
