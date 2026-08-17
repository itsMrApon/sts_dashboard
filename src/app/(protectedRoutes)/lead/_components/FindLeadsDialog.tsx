'use client'

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Loader2, MapPin, Search, Sparkles } from 'lucide-react'
import { suggestLeadFind } from '@/actions/callIntel'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  MAPS_LOCATION_SUGGESTIONS,
  MAPS_NICHE_SUGGESTIONS,
  buildMapsFindPreview,
} from '@/lib/leads/leadFindSuggestions'

export type FindRecentSearch = {
  location: string
  niche: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  location: string
  niche: string
  onLocationChange: (value: string) => void
  onNicheChange: (value: string) => void
  recentSearches?: FindRecentSearch[]
  serperConfigured?: boolean
  pending?: boolean
  onSubmit: () => void
}

function SuggestField(props: {
  id: string
  label: string
  hint: string
  placeholder: string
  value: string
  mode: 'location' | 'niche'
  icon: ReactNode
  onChange: (value: string) => void
  seedChips: string[]
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [source, setSource] = useState<'curated' | 'serper' | 'mixed'>('curated')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reqId = useRef(0)

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
    }
  }, [])

  function loadSuggestions(query: string) {
    const id = ++reqId.current
    setLoading(true)
    void suggestLeadFind({ mode: props.mode, query }).then((res) => {
      if (id !== reqId.current) return
      setLoading(false)
      if (res.ok && res.data) {
        setSuggestions(res.data.suggestions)
        setSource(res.data.source)
      } else {
        setSuggestions(
          props.seedChips.filter((c) =>
            query.trim()
              ? c.toLowerCase().includes(query.trim().toLowerCase())
              : true,
          ).slice(0, 8),
        )
        setSource('curated')
      }
    })
  }

  function scheduleSuggest(query: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadSuggestions(query), 280)
  }

  function pick(value: string) {
    props.onChange(value)
    setOpen(false)
  }

  const chips =
    props.value.trim().length === 0
      ? props.seedChips.slice(0, 6)
      : suggestions.slice(0, 6)

  return (
    <div className="grid gap-2">
      <div className="flex items-end justify-between gap-2">
        <Label htmlFor={props.id}>{props.label}</Label>
        <span className="text-[11px] text-muted-foreground">{props.hint}</span>
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {props.icon}
        </div>
        <Input
          id={props.id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={props.placeholder}
          value={props.value}
          className="pl-9 pr-9"
          onFocus={() => {
            setOpen(true)
            loadSuggestions(props.value)
          }}
          onBlur={() => {
            blurTimerRef.current = setTimeout(() => setOpen(false), 150)
          }}
          onChange={(e) => {
            props.onChange(e.target.value)
            setOpen(true)
            scheduleSuggest(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
            if (e.key === 'ArrowDown' && suggestions[0]) {
              e.preventDefault()
              setOpen(true)
            }
            if (e.key === 'Enter' && open && suggestions[0]) {
              e.preventDefault()
              pick(suggestions[0])
            }
          }}
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}

        {open && (suggestions.length > 0 || loading) ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-md border bg-popover p-1 text-sm shadow-md"
          >
            {suggestions.length === 0 && loading ? (
              <li className="px-2 py-2 text-muted-foreground">Searching…</li>
            ) : null}
            {suggestions.map((item) => (
              <li key={item} role="option">
                <button
                  type="button"
                  className="flex w-full items-center rounded-sm px-2 py-1.5 text-left hover:bg-accent hover:text-accent-foreground"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(item)}
                >
                  {item}
                </button>
              </li>
            ))}
            {source !== 'curated' ? (
              <li className="border-t px-2 py-1.5 text-[10px] text-muted-foreground">
                Powered by Google suggestions via Serper
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => pick(chip)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-[11px] transition-colors',
              props.value.trim().toLowerCase() === chip.toLowerCase()
                ? 'border-foreground/40 bg-foreground/5'
                : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
            )}
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  )
}

export function FindLeadsDialog(props: Props) {
  const preview = buildMapsFindPreview(props.niche, props.location)
  const canSubmit =
    props.location.trim().length > 0 && props.niche.trim().length > 0

  const recent = (props.recentSearches || [])
    .filter((r) => r.location.trim() && r.niche.trim())
    .reduce<FindRecentSearch[]>((acc, row) => {
      const key = `${row.niche}||${row.location}`.toLowerCase()
      if (acc.some((a) => `${a.niche}||${a.location}`.toLowerCase() === key)) {
        return acc
      }
      acc.push(row)
      return acc
    }, [])
    .slice(0, 4)

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="size-4" />
            Find leads on Maps
          </DialogTitle>
          <DialogDescription>
            Same pattern as Google Maps: pick a place, pick a business type, we
            search <span className="font-medium">type in location</span> and pull
            10 fresh leads. Website scrape runs when you open a lead.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-1">
          <SuggestField
            id="find-location"
            label="Where"
            hint="Area, city, or neighborhood"
            placeholder="Start typing — e.g. Gulshan, Dhaka"
            value={props.location}
            mode="location"
            icon={<MapPin className="size-4" />}
            onChange={props.onLocationChange}
            seedChips={MAPS_LOCATION_SUGGESTIONS}
          />

          <SuggestField
            id="find-niche"
            label="What"
            hint="Business type / niche"
            placeholder="Start typing — e.g. dental clinics"
            value={props.niche}
            mode="niche"
            icon={<Sparkles className="size-4" />}
            onChange={props.onNicheChange}
            seedChips={MAPS_NICHE_SUGGESTIONS}
          />

          {recent.length > 0 ? (
            <div className="grid gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Recent searches
              </p>
              <div className="flex flex-wrap gap-1.5">
                {recent.map((row) => {
                  const label = `${row.niche} · ${row.location}`
                  return (
                    <button
                      key={label}
                      type="button"
                      className="rounded-md border border-border px-2 py-1 text-left text-[11px] text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                      onClick={() => {
                        props.onLocationChange(row.location)
                        props.onNicheChange(row.niche)
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          <div className="rounded-md border bg-muted/40 px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Maps query preview
            </p>
            <p className="mt-1 font-mono text-sm leading-snug">{preview}</p>
          </div>

          {!props.serperConfigured ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Serper API key missing. Add it under Settings → Lead APIs to enable
              live suggestions and Maps pulls.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={props.pending}
            onClick={() => props.onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={props.pending || !canSubmit}
            onClick={() => props.onSubmit()}
          >
            {props.pending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Pulling…
              </>
            ) : (
              'Save & pull 10'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
