'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { listXaiModels } from '@/actions/agentEngine'
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
import { llmModelsForProvider } from '@/lib/agents/engineOptions'
import { isXaiModelId, labelForLlmModelId } from '@/lib/llm/modelOptions'
import { cn } from '@/lib/utils'

const SUGGESTED = llmModelsForProvider('xai')

/** Grok model combobox: suggested default, live list from the user's xAI key, or a typed id. */
export function XaiModelPicker({
  id,
  value,
  onChange,
}: {
  id?: string
  value: string
  onChange: (modelId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [models, setModels] = useState<{ id: string }[] | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (models || loading) return
    setLoading(true)
    try {
      const res = await listXaiModels()
      setModels(res.ok ? res.models : [])
    } finally {
      setLoading(false)
    }
  }

  const trimmedQuery = query.trim()
  const knownIds = new Set([...SUGGESTED.map((m) => m.id), ...(models ?? []).map((m) => m.id)])
  const canUseCustom = isXaiModelId(trimmedQuery) && !knownIds.has(trimmedQuery)
  const live = (models ?? []).filter((model) => !SUGGESTED.some((s) => s.id === model.id))
  const choose = (next: string) => {
    onChange(next)
    setOpen(false)
    setQuery('')
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) void load()
      }}
    >
      <PopoverTrigger asChild>
        <Button id={id} variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className="truncate">{labelForLlmModelId(value)}</span>
          <ChevronsUpDown className="opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search or type grok-…" value={query} onValueChange={setQuery} />
          <CommandList className="max-h-72">
            <CommandEmpty>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin" /> Loading models from your xAI key…
                </span>
              ) : (
                'No match. Type an exact model id starting with grok-.'
              )}
            </CommandEmpty>
            {canUseCustom ? (
              <CommandGroup heading="Custom">
                <CommandItem value={`custom ${trimmedQuery}`} onSelect={() => choose(trimmedQuery)}>
                  Use <code className="font-mono">{trimmedQuery}</code>
                </CommandItem>
              </CommandGroup>
            ) : null}
            <CommandGroup heading="Suggested">
              {SUGGESTED.map((model) => (
                <CommandItem key={model.id} value={`${model.id} ${model.label}`} onSelect={() => choose(model.id)}>
                  <Check className={cn('size-3.5', value === model.id ? 'opacity-100' : 'opacity-0')} />
                  {model.label}
                </CommandItem>
              ))}
            </CommandGroup>
            {live.length ? (
              <CommandGroup heading="On your xAI key">
                {live.map((model) => (
                  <CommandItem key={model.id} value={model.id} onSelect={() => choose(model.id)}>
                    <Check className={cn('size-3.5', value === model.id ? 'opacity-100' : 'opacity-0')} />
                    <span className="font-mono text-xs">{model.id}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : models && !loading ? (
              <p className="px-3 py-2 text-[11px] text-muted-foreground">Add an xAI key to see every Grok model.</p>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
