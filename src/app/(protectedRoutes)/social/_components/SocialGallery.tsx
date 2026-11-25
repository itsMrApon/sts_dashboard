'use client'

import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  CHANNEL_LABEL,
  KIND_SEGMENTS,
  SEGMENT_KIND,
  SEGMENT_LABEL,
  SOCIAL_LIBRARY,
  type KindSegment,
} from '@/lib/social/library'
import { NEEDS } from '@/lib/social/library/needs'
import type { SocialChannel, SocialItem } from '@/lib/social/library/types'
import { useSocialSaves } from '../_lib/useSocialPrefs'
import { SocialCard } from './SocialCard'
import { SocialPreviewDialog } from './SocialPreviewDialog'

const PAGE = 24

/** Channels in the order a creator thinks of them; only the ones some card uses are shown. */
const CHANNEL_ORDER: SocialChannel[] = ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'x', 'whatsapp', 'telegram', 'blog', 'email', 'print']

function matchesSegment(item: SocialItem, segment: KindSegment, saved: readonly string[]) {
  if (segment === 'all') return true
  if (segment === 'saved') return saved.includes(item.id)
  return item.kind === SEGMENT_KIND[segment]
}

function matchesQuery(item: SocialItem, query: string) {
  if (!query) return true
  const haystack = [item.title, item.summary, item.source.label, ...item.channels, ...item.formats, ...item.needs.map((n) => NEEDS[n].label)]
    .join(' ')
    .toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word))
}

/**
 * The library: a top menu of kinds (All, Skills, Prompts, Workflows, Plugins, Reports, Saved),
 * channel chips and search, then a grid of diagram cards. Filters stay in the URL (/social/<kind>,
 * ?item= for the open card) without a server round trip, since the library is static.
 */
export function SocialGallery({ initialSegment }: { initialSegment: KindSegment }) {
  const searchParams = useSearchParams()
  const { ids: savedIds, has, toggle } = useSocialSaves()
  const [segment, setSegment] = useState<KindSegment>(initialSegment)
  const [channel, setChannel] = useState<SocialChannel | null>(null)
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [openId, setOpenId] = useState<string | null>(() => searchParams.get('item'))

  const counts = useMemo(() => {
    const result = {} as Record<KindSegment, number>
    for (const seg of KIND_SEGMENTS) result[seg] = SOCIAL_LIBRARY.filter((item) => matchesSegment(item, seg, savedIds)).length
    return result
  }, [savedIds])

  const inSegment = useMemo(() => SOCIAL_LIBRARY.filter((item) => matchesSegment(item, segment, savedIds)), [segment, savedIds])

  const channels = useMemo(() => {
    const used = new Set(inSegment.flatMap((item) => item.channels))
    return CHANNEL_ORDER.filter((c) => used.has(c))
  }, [inSegment])

  const filtered = useMemo(
    () => inSegment.filter((item) => (!channel || item.channels.includes(channel)) && matchesQuery(item, query.trim())),
    [inSegment, channel, query],
  )

  // Keep the address bar in step with the menu and the open card, without a navigation.
  useEffect(() => {
    const url = new URL(window.location.href)
    url.pathname = `/social/${segment}`
    if (openId) url.searchParams.set('item', openId)
    else url.searchParams.delete('item')
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url)
  }, [segment, openId])

  function pickSegment(next: KindSegment) {
    setSegment(next)
    setShown(PAGE)
    if (channel && !SOCIAL_LIBRARY.some((item) => matchesSegment(item, next, savedIds) && item.channels.includes(channel))) setChannel(null)
  }

  // The open card walks through the current filter; one opened from a link may sit outside it.
  const list = filtered.some((item) => item.id === openId) ? filtered : SOCIAL_LIBRARY
  const openIndex = openId ? list.findIndex((item) => item.id === openId) : -1
  const openItem = openIndex >= 0 ? list[openIndex] : null

  const step = useCallback(
    (delta: number) => {
      if (openIndex < 0 || list.length === 0) return
      setOpenId(list[(openIndex + delta + list.length) % list.length].id)
    },
    [openIndex, list],
  )

  return (
    <div className="flex w-full flex-col gap-5 pb-10">
      {/* Kinds, like the gallery's All / Architecture / Design… */}
      <div className="flex flex-col gap-3">
        <div role="tablist" aria-label="Library sections" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {KIND_SEGMENTS.map((seg) => (
            <button
              key={seg}
              type="button"
              role="tab"
              aria-selected={segment === seg}
              onClick={() => pickSegment(seg)}
              className={cn(
                'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors',
                'focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none',
                segment === seg ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted',
              )}
            >
              {SEGMENT_LABEL[seg]}
              <span className={cn('text-xs tabular-nums', segment === seg ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
                {counts[seg]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative md:w-72">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setShown(PAGE)
              }}
              placeholder="Search: reels, n8n, Higgsfield…"
              aria-label="Search the library"
              className="h-9 pl-8"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
          <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Channels">
            {channels.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={channel === c}
                onClick={() => {
                  setChannel(channel === c ? null : c)
                  setShown(PAGE)
                }}
                className={cn(
                  'h-7 shrink-0 rounded-full border px-2.5 text-xs transition-colors',
                  channel === c ? 'border-foreground/50 bg-muted font-medium' : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {CHANNEL_LABEL[c]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center text-sm">
          {segment === 'saved' && savedIds.length === 0 ? (
            <>
              <p className="text-foreground font-medium">Nothing saved yet</p>
              <p>Open any card and press Save. Saved cards stay on this device.</p>
              <button type="button" onClick={() => pickSegment('all')} className="text-foreground underline">
                Browse all
              </button>
            </>
          ) : (
            <>
              <p className="text-foreground font-medium">No cards match</p>
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setChannel(null)
                }}
                className="text-foreground underline"
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <motion.div layout className="grid gap-x-5 gap-y-7 sm:grid-cols-2 xl:grid-cols-3" role="list" aria-label="Library cards">
          <AnimatePresence mode="popLayout" initial={false}>
            {filtered.slice(0, shown).map((item, index) => (
              <motion.div
                key={item.id}
                layout
                role="listitem"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.22, delay: Math.min(index % PAGE, 12) * 0.02 }}
              >
                <SocialCard item={item} saved={has(item.id)} onOpen={() => setOpenId(item.id)} onToggleSave={() => toggle(item.id)} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {filtered.length > shown ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShown((n) => n + PAGE)}
            className="border-border hover:bg-muted h-9 rounded-md border px-4 text-sm font-medium transition-colors"
          >
            Show more ({filtered.length - shown} left)
          </button>
        </div>
      ) : null}

      <p className="text-muted-foreground text-center text-xs">
        Workflows come from{' '}
        <a href="https://github.com/Zie619/n8n-workflows" target="_blank" rel="noreferrer" className="underline">
          n8n-workflows
        </a>
        ; diagrams follow{' '}
        <a href="https://github.com/cathrynlavery/diagram-design" target="_blank" rel="noreferrer" className="underline">
          diagram-design
        </a>
        . New here? <Link href="/social" className="underline">Connect your agent first</Link>.
      </p>

      <SocialPreviewDialog
        item={openItem}
        saved={openItem ? has(openItem.id) : false}
        position={openItem ? { index: openIndex, total: list.length } : null}
        onToggleSave={() => openItem && toggle(openItem.id)}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        onClose={() => setOpenId(null)}
      />
    </div>
  )
}
