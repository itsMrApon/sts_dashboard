'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { toast } from '@/lib/toast'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const SEARCH_DEBOUNCE_MS = 350

/** Searchable Fish Audio voice picker (owned voices first). Value is the Fish reference_id. */
export function FishVoicePicker({
  value,
  valueLabel,
  onChange,
}: {
  value: string
  valueLabel?: string | null
  onChange: (voiceId: string, voiceTitle: string) => void
}) {
  const [voices, setVoices] = useState<FishVoiceOption[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [language, setLanguage] = useState<FishVoiceLanguageFilter>('bn')
  const [open, setOpen] = useState(false)

  const loadVoices = useCallback(async (query: string, filter: FishVoiceLanguageFilter) => {
    setLoading(true)
    try {
      const result = await listFishVoices({ search: query.trim() || undefined, language: filter })
      if (!result.success || !result.data) {
        toast.error(result.error || "Couldn't load the voices right now.")
        setVoices([])
        return
      }
      setVoices(result.data)
    } catch {
      toast.error("Couldn't load the voices right now.")
      setVoices([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const handle = window.setTimeout(() => void loadVoices(search, language), search ? SEARCH_DEBOUNCE_MS : 0)
    return () => window.clearTimeout(handle)
  }, [search, language, loadVoices])

  const selected = useMemo(() => voices.find((voice) => voice.id === value) ?? null, [voices, value])
  const owned = voices.filter((voice) => voice.owned)
  const publicVoices = voices.filter((voice) => !voice.owned)

  const triggerLabel = selected
    ? `${selected.title}${selected.owned ? ' (yours)' : ''}`
    : valueLabel || (value ? value : loading ? 'Loading Fish voices…' : 'Select a Fish voice')

  const renderVoice = (voice: FishVoiceOption) => (
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
        <span className="truncate font-mono text-xs text-muted-foreground">
          {voice.id}
          {!voice.owned && voice.languages.length ? ` · ${voice.languages.join(', ')}` : ''}
        </span>
      </span>
    </CommandItem>
  )

  return (
    <div className="flex items-center gap-2">
      <Select value={language} onValueChange={(next) => setLanguage(next as FishVoiceLanguageFilter)}>
        <SelectTrigger aria-label="Voice language filter" className="h-9 w-[5.5rem] shrink-0 px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="bn">বাংলা</SelectItem>
          <SelectItem value="en">English</SelectItem>
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
            className="min-w-0 flex-1 justify-between font-normal"
          >
            <span className="truncate text-left">{triggerLabel}</span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(28rem,calc(100vw-2rem))] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={language === 'bn' ? 'Search Bangla voices…' : 'Search Fish voices…'}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                {loading
                  ? 'Loading…'
                  : language === 'bn'
                    ? 'No Bangla-tagged voices found. Try All, or clone a Bangla voice on fish.audio.'
                    : 'No voices found. Save a Fish API key in Config Agent.'}
              </CommandEmpty>
              {owned.length > 0 ? <CommandGroup heading="Your voices">{owned.map(renderVoice)}</CommandGroup> : null}
              {publicVoices.length > 0 ? (
                <CommandGroup heading="Public voices">{publicVoices.map(renderVoice)}</CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
