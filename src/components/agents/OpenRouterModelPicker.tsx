'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { listOpenRouterModels } from '@/actions/agentEngine'
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
import type { OpenRouterModel } from '@/lib/llm/openRouterModels'
import { isOpenRouterModelId, labelForLlmModelId } from '@/lib/llm/modelOptions'
import { cn } from '@/lib/utils'

const SUGGESTED = llmModelsForProvider('openrouter')

function priceLabel(model: OpenRouterModel): string | null {
  if (model.promptPerMillion === null || model.completionPerMillion === null) return null
  if (model.promptPerMillion === 0 && model.completionPerMillion === 0) return 'free'
  const fmt = (value: number) => `$${value < 1 ? value.toFixed(2) : value.toFixed(value < 10 ? 1 : 0)}`
  return `${fmt(model.promptPerMillion)} / ${fmt(model.completionPerMillion)} per 1M`
}

export function OpenRouterModelPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (modelId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [models, setModels] = useState<OpenRouterModel[] | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (models || loading) return
    setLoading(true)
    try {
      const res = await listOpenRouterModels()
      setModels(res.ok ? res.models : [])
    } finally {
      setLoading(false)
    }
  }

  const trimmedQuery = query.trim()
  const knownIds = new Set([...SUGGESTED.map((m) => m.id), ...(models ?? []).map((m) => m.id)])
  const canUseCustom = isOpenRouterModelId(trimmedQuery) && !knownIds.has(trimmedQuery)
  const current = models?.find((m) => m.id === value)
  const choose = (id: string) => {
    onChange(id)
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
        <Button
          id="engine-llm-model"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{current?.name ?? labelForLlmModelId(value)}</span>
          <ChevronsUpDown className="opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-80 p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search 300+ models or paste vendor/model"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-80">
            <CommandEmpty>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin" /> Loading OpenRouter models…
                </span>
              ) : (
                'No model matches. Paste an exact id like vendor/model.'
              )}
            </CommandEmpty>
            {canUseCustom ? (
              <CommandGroup heading="Custom">
                <CommandItem value={`custom ${trimmedQuery}`} onSelect={() => choose(trimmedQuery)}>
                  Use <code className="font-mono">{trimmedQuery}</code>
                </CommandItem>
              </CommandGroup>
            ) : null}
            <CommandGroup heading="Suggested for voice">
              {SUGGESTED.map((model) => (
                <CommandItem key={model.id} value={`${model.id} ${model.label}`} onSelect={() => choose(model.id)}>
                  <Check className={cn('size-3.5', value === model.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{model.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {models?.length ? (
              <CommandGroup heading={`All models (${models.length})`}>
                {models.map((model) => {
                  const price = priceLabel(model)
                  return (
                    <CommandItem key={model.id} value={`${model.id} ${model.name}`} onSelect={() => choose(model.id)}>
                      <Check className={cn('size-3.5', value === model.id ? 'opacity-100' : 'opacity-0')} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{model.name}</span>
                        <span className="block truncate font-mono text-[10px] text-muted-foreground">{model.id}</span>
                      </span>
                      {price ? <span className="shrink-0 text-[10px] text-muted-foreground">{price}</span> : null}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
