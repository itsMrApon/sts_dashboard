'use client'

import { ArrowUpRight, Bookmark, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { SocialDiagram } from '@/components/social/SocialDiagram'
import { diagramThemeClass } from '@/components/social/fonts'
import { CHANNEL_LABEL, FORMAT_LABEL, KIND_LABEL } from '@/lib/social/library'
import { AGENT_CLIENT_LABEL, buildSocialPrompt } from '@/lib/social/library/buildPrompt'
import { NEEDS } from '@/lib/social/library/needs'
import type { SocialItem } from '@/lib/social/library/types'
import { useAgentClient } from '../_lib/useSocialPrefs'
import { CopyPromptButton } from './CopyPromptButton'

/**
 * The full-screen preview, like 21st.dev's: the diagram large, Save and Copy prompt under it,
 * and beside it what the item connects and the whole prompt the agent will get. Arrow keys (and
 * the side buttons) walk through the cards in the current filter.
 */
export function SocialPreviewDialog({
  item,
  saved,
  position,
  onToggleSave,
  onPrev,
  onNext,
  onClose,
}: {
  item: SocialItem | null
  saved: boolean
  position: { index: number; total: number } | null
  onToggleSave: () => void
  onPrev: () => void
  onNext: () => void
  onClose: () => void
}) {
  const [client] = useAgentClient()
  const prompt = useMemo(() => (item ? buildSocialPrompt(item, client) : ''), [item, client])

  useEffect(() => {
    if (!item) return
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [role="menu"]')) return
      if (event.key === 'ArrowLeft') onPrev()
      if (event.key === 'ArrowRight') onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item, onPrev, onNext])

  return (
    <Dialog open={Boolean(item)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex h-[92vh] w-[min(1240px,96vw)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
        {item ? (
          <>
            <div className="flex items-start gap-3 border-b border-border px-5 py-3.5 pr-12">
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-base">{item.title}</DialogTitle>
                <DialogDescription className="mt-1 truncate text-xs">
                  {KIND_LABEL[item.kind]} ·{' '}
                  <a href={item.source.url} target="_blank" rel="noreferrer" className="hover:text-foreground inline-flex items-center gap-0.5 underline-offset-2 hover:underline">
                    {item.source.label}
                    <ArrowUpRight className="size-3" aria-hidden />
                  </a>
                  {position ? ` · ${position.index + 1} of ${position.total}` : ''}
                </DialogDescription>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_400px] lg:overflow-hidden">
              {/* Preview */}
              <div className="relative flex min-h-0 flex-col bg-muted/40">
                <div className="flex min-h-0 flex-1 items-center justify-center p-4 sm:p-8">
                  <div className={cn(diagramThemeClass, 'w-full max-w-[880px] overflow-hidden rounded-lg border border-border')}>
                    <SocialDiagram
                      diagram={item.diagram}
                      uid={`dialog-${item.id}`}
                      title={item.title}
                      caption={KIND_LABEL[item.kind]}
                      className="block h-auto w-full"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 border-t border-border px-4 py-3.5 lg:border-t-0 lg:pb-6">
                  <button
                    type="button"
                    onClick={() => {
                      onToggleSave()
                      toast.success(saved ? 'Removed from saved' : 'Saved', { description: saved ? undefined : 'Find it under Social → Saved.' })
                    }}
                    aria-pressed={saved}
                    className={cn(
                      'inline-flex h-10 items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted',
                      saved && 'text-primary',
                    )}
                  >
                    {saved ? 'Saved' : 'Save'}
                    <Bookmark className={cn('size-4', saved && 'fill-current')} aria-hidden />
                  </button>
                  <CopyPromptButton item={item} />
                </div>
                <button
                  type="button"
                  onClick={onPrev}
                  aria-label="Previous card"
                  className="bg-background/80 hover:bg-background absolute top-1/2 left-2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border sm:inline-flex"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  aria-label="Next card"
                  className="bg-background/80 hover:bg-background absolute top-1/2 right-2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border sm:inline-flex"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>

              {/* Details + the full prompt */}
              <aside className="flex min-h-0 flex-col overflow-y-auto border-t border-border lg:border-t-0 lg:border-l">
                <div className="space-y-4 px-5 py-4">
                  <p className="text-sm leading-relaxed">{item.summary}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.channels.map((c) => (
                      <span key={c} className="rounded-full border border-border px-2 py-0.5 text-[11px]">
                        {CHANNEL_LABEL[c]}
                      </span>
                    ))}
                    {item.formats
                      .filter((f) => f !== 'automation' || item.kind === 'workflow')
                      .map((f) => (
                        <span key={f} className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px]">
                          {FORMAT_LABEL[f]}
                        </span>
                      ))}
                  </div>
                  <div>
                    <h3 className="text-muted-foreground mb-2 text-[11px] font-medium tracking-wide uppercase">Your agent will connect</h3>
                    <ul className="space-y-1.5">
                      {item.needs.map((id) => (
                        <li key={id} className="flex items-center gap-2 text-sm">
                          <span
                            aria-hidden
                            className={cn('size-1.5 flex-none rounded-full', id === 'stsBrain' ? 'bg-primary' : 'bg-muted-foreground/50')}
                          />
                          <span className="truncate" title={NEEDS[id].how}>
                            {NEEDS[id].label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="flex min-h-0 flex-1 flex-col border-t border-border">
                  <div className="text-muted-foreground flex items-center justify-between px-5 pt-3 pb-2 text-[11px] font-medium tracking-wide uppercase">
                    <span>Prompt</span>
                    <span className="normal-case tracking-normal">for {AGENT_CLIENT_LABEL[client]}</span>
                  </div>
                  <pre className="bg-muted/50 text-foreground/90 mx-5 mb-5 min-h-48 flex-1 overflow-auto rounded-md p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap">
                    {prompt}
                  </pre>
                </div>
              </aside>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
