'use client'

import { useEffect, useState } from 'react'
import { Bot, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings2, X } from 'lucide-react'
import type { AssistantSummary } from '@/actions/assistants'
import { Button } from '@/components/ui/button'
import { CategoryList, type Category } from '@/components/ui/category-list'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ASSISTANT_SERVICE_META } from '@/lib/agents/assistantServices'
import { cn } from '@/lib/utils'
import { RAIL_COOKIE } from './railCookie'

type Props = {
  assistants: AssistantSummary[]
  activeId: string | null
  /** Saved state from the cookie; phones always show the full list. */
  initialCollapsed: boolean
  creating: boolean
  onOpen: (assistant: AssistantSummary) => void
  onCreate: () => void
  onConfig: () => void
  onDelete: (assistant: AssistantSummary) => void
}

function serviceLabel(assistant: AssistantSummary): string {
  return assistant.service ? ASSISTANT_SERVICE_META[assistant.service].label : 'Classic · any service'
}

function statusLine(assistant: AssistantSummary): string {
  if (assistant.inUse.length === 0) return `${serviceLabel(assistant)} · not in use`
  return `${serviceLabel(assistant)} · running ${assistant.inUse.map((service) => ASSISTANT_SERVICE_META[service].label).join(', ')}`
}

/** First letter or digit of the name (Unicode-aware, so Bangla names get their own letter). */
function initial(name: string): string {
  const match = name.match(/[\p{L}\p{N}]/u)
  return match ? match[0].toUpperCase() : '?'
}

/** A one-letter tile, drawn like the app marks in the workflow's connection stack. */
export function AssistantMark({ assistant, active }: { assistant: AssistantSummary; active: boolean }) {
  return (
    <span
      className={cn(
        'relative grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border bg-card text-[14px] font-bold transition-colors',
        active ? 'border-violet-400/70 bg-violet-500/15 text-violet-200' : 'border-border text-violet-400 hover:border-violet-400/50',
      )}
      aria-hidden
    >
      {initial(assistant.name)}
      {assistant.inUse.length > 0 ? (
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-400" />
      ) : null}
    </span>
  )
}

/** Same surface as the workflow's connection stack (card with a hint of the violet accent). */
const RAIL_SURFACE = 'bg-[color-mix(in_srgb,var(--card)_94%,oklch(0.68_0.19_293))]'

function writeCookie(collapsed: boolean) {
  document.cookie = `${RAIL_COOKIE}=${collapsed ? 'collapsed' : 'open'}; path=/ai-agents; max-age=31536000; samesite=lax`
}

/**
 * The assistants list as a rail: a 64px strip of letter tiles, or the full boxed list. The state is
 * remembered in a cookie; `[` toggles it from anywhere on the page outside a text field.
 */
export function AssistantRail({ assistants, activeId, initialCollapsed, creating, onOpen, onCreate, onConfig, onDelete }: Props) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const [query, setQuery] = useState('')

  const toggle = (next: boolean) => {
    setCollapsed(next)
    writeCookie(next)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '[' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      event.preventDefault()
      setCollapsed((current) => {
        writeCookie(!current)
        return !current
      })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const needle = query.trim().toLowerCase()
  const shown = needle ? assistants.filter((assistant) => assistant.name.toLowerCase().includes(needle)) : assistants
  const categories: Category[] = shown.map((assistant) => ({
    id: assistant.id,
    title: assistant.name,
    subtitle: statusLine(assistant),
    featured: assistant.inUse.length > 0,
    // The business-address assistant can't be deleted (public links hang off it): no X.
    action: assistant.isBusinessAddress ? null : (
      <button
        type="button"
        onClick={() => onDelete(assistant)}
        aria-label={`Delete ${assistant.name}`}
        title="Delete assistant"
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </button>
    ),
    badge: assistant.inUse.length ? (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        live
      </span>
    ) : null,
    onClick: () => onOpen(assistant),
  }))

  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full flex-col transition-[width] duration-200 ease-out motion-reduce:transition-none md:border-r md:border-border',
        RAIL_SURFACE,
        collapsed ? 'md:w-16' : 'md:w-[300px]',
      )}
    >
      {/* The full boxed list (always on phones). */}
      <div className={cn('flex min-h-0 flex-1 flex-col', collapsed && 'md:hidden')}>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <CategoryList
            compact
            className="bg-transparent"
            rowClassName="bg-background/60"
            title="Your"
            subtitle="Assistants"
            headerIcon={<Bot className="h-5 w-5" />}
            categories={categories}
            activeId={creating ? null : activeId}
            headerAction={
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => toggle(true)}
                    aria-label="Collapse assistants"
                    className="hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:flex"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Collapse <kbd className="ml-1 rounded bg-background/20 px-1 font-mono">[</kbd>
                </TooltipContent>
              </Tooltip>
            }
            toolbar={
              <div className="mb-3 space-y-2">
                <Button className="w-full" onClick={onCreate}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  New assistant
                </Button>
                {assistants.length > 3 ? (
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search assistants"
                      aria-label="Search assistants"
                      className="pl-9"
                    />
                  </div>
                ) : null}
              </div>
            }
            empty={
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                {query ? 'No assistant matches.' : 'No assistants yet.'}
              </p>
            }
          />
        </div>
        {/* Settings live at the bottom, like the collapsed strip's gear. */}
        <div className="border-t border-border p-4">
          <Button variant="outline" className="w-full bg-background/60" onClick={onConfig}>
            <Settings2 className="mr-1.5 h-4 w-4" />
            Config Agent
          </Button>
        </div>
      </div>

      {/* Collapsed strip of letter tiles (md+ only). */}
      {collapsed ? (
        <div className="hidden min-h-0 flex-1 flex-col items-center md:flex">
          <div className="flex flex-col items-center gap-2 pb-3 pt-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => toggle(false)}
                  aria-label="Expand assistants"
                  className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Expand <kbd className="ml-1 rounded bg-background/20 px-1 font-mono">[</kbd>
              </TooltipContent>
            </Tooltip>
            <span
              className="rotate-180 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground [writing-mode:vertical-rl]"
              aria-hidden
            >
              Agents
            </span>
          </div>
          <nav aria-label="Assistants" className="min-h-0 w-full flex-1 overflow-y-auto pb-3 pt-1">
            <ul className="flex flex-col items-center gap-2.5">
              {assistants.map((assistant) => {
                const active = !creating && assistant.id === activeId
                return (
                  <li key={assistant.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onOpen(assistant)}
                          aria-label={`${assistant.name}: ${statusLine(assistant)}`}
                          aria-current={active ? 'page' : undefined}
                          className="block rounded-[10px] transition-transform active:scale-95 motion-reduce:transition-none"
                        >
                          <AssistantMark assistant={assistant} active={active} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-56">
                        <span className="block font-medium">{assistant.name}</span>
                        <span className="block opacity-70">{statusLine(assistant)}</span>
                      </TooltipContent>
                    </Tooltip>
                  </li>
                )
              })}
              <li>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onCreate}
                      aria-label="New assistant"
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-[10px] border border-dashed border-border text-muted-foreground transition-colors hover:border-violet-400/60 hover:text-violet-300',
                        creating && 'border-solid border-violet-400/70 bg-violet-500/15 text-violet-200',
                      )}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">New assistant</TooltipContent>
                </Tooltip>
              </li>
            </ul>
          </nav>
          <div className="border-t border-border py-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onConfig}
                  aria-label="Config Agent"
                  className="flex h-10 w-10 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Settings2 className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Config Agent</TooltipContent>
            </Tooltip>
          </div>
        </div>
      ) : null}
    </div>
  )
}
