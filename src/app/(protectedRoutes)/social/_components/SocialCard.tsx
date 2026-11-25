'use client'

import { Bookmark, ZoomIn } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { SocialDiagram } from '@/components/social/SocialDiagram'
import { diagramThemeClass } from '@/components/social/fonts'
import { CHANNEL_LABEL, KIND_LABEL } from '@/lib/social/library'
import type { SocialItem } from '@/lib/social/library/types'

/** One library card: the diagram as the preview, then the name, kind and channels. */
export function SocialCard({
  item,
  saved,
  onOpen,
  onToggleSave,
}: {
  item: SocialItem
  saved: boolean
  onOpen: () => void
  onToggleSave: () => void
}) {
  const channels = item.channels.slice(0, 3).map((c) => CHANNEL_LABEL[c])
  const more = item.channels.length - channels.length

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpen()
    }
  }

  return (
    <div className="group flex flex-col gap-2.5">
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={onKeyDown}
        aria-label={`Preview ${item.title}`}
        className={cn(
          diagramThemeClass,
          'relative aspect-[16/10] cursor-pointer overflow-hidden rounded-lg border border-border transition-colors',
          'hover:border-ring focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none',
        )}
      >
        {/* Wrapped: the app hides an svg that is the first child of a button (leading icons). */}
        <div className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]">
          <SocialDiagram diagram={item.diagram} uid={`card-${item.id}`} title={item.title} caption={KIND_LABEL[item.kind]} className="h-full w-full" />
        </div>
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/35 group-hover:opacity-100"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
            <ZoomIn className="size-3.5" />
            Preview
          </span>
        </div>
      </div>
      <div className="flex items-start gap-2 px-0.5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium" title={item.title}>
            {item.title}
          </h3>
          <p className="text-muted-foreground truncate text-xs">
            <span className="text-foreground/80">{KIND_LABEL[item.kind]}</span>
            {channels.length ? ` · ${channels.join(', ')}${more > 0 ? ` +${more}` : ''}` : ''}
            {item.nodeCount ? ` · ${item.nodeCount} nodes` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleSave}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${item.title} from saved` : `Save ${item.title}`}
          className={cn(
            'inline-flex size-8 flex-none items-center justify-center rounded-md transition-colors hover:bg-muted',
            saved ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <Bookmark className={cn('size-4', saved && 'fill-current')} />
        </button>
      </div>
    </div>
  )
}
