'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Loader2, X } from 'lucide-react'
import type { AssistantSummary } from '@/actions/assistants'
import { Button } from '@/components/ui/button'
import { ASSISTANT_SERVICE_META, type AssistantService } from '@/lib/agents/assistantServices'
import { estimateTokens } from '@/lib/agents/promptLint'
import { cn } from '@/lib/utils'

/** What the drawer shows: the prompt, or one service's behaviour, optionally at a subsection. */
export type ConfigTarget = { group: 'prompt'; section?: string } | { group: 'behaviour'; service: AssistantService; section?: string }

export const PROMPT_SECTIONS = [
  { id: 'language', label: 'Language' },
  { id: 'first-message', label: 'First message' },
  { id: 'system', label: 'System prompt' },
] as const

/** Mirrors each configurator's StudioSection ids (rendered as `studio-<id>`). */
export const SERVICE_SECTIONS: Record<AssistantService, { id: string; label: string }[]> = {
  chat: [
    { id: 'persona', label: 'Persona' },
    { id: 'conversation', label: 'Conversation' },
    { id: 'behaviour', label: 'Behaviour' },
    { id: 'limits', label: 'Limits' },
  ],
  voice: [
    { id: 'voice', label: 'Voice' },
    { id: 'persona', label: 'Persona' },
    { id: 'call', label: 'Call' },
  ],
  form: [
    { id: 'content', label: 'Content' },
    { id: 'questions', label: 'Questions' },
    { id: 'after', label: 'After submit' },
    { id: 'delivery', label: 'Delivery' },
  ],
  tour: [
    { id: 'basics', label: 'Basics' },
    { id: 'playback', label: 'Playback' },
    { id: 'steps', label: 'Steps' },
  ],
}

/** Node gear keys: `prompt`, `prompt:<section>`, `behaviour:<service>[:<section>]`. */
export function parseConfigKey(key: string): ConfigTarget | null {
  const [group, a, b] = key.split(':')
  if (group === 'prompt') return { group: 'prompt', section: a }
  if (group === 'behaviour' && a && a in SERVICE_SECTIONS) return { group: 'behaviour', service: a as AssistantService, section: b }
  return null
}

function anchorId(target: ConfigTarget): string | null {
  if (!target.section) return null
  return target.group === 'prompt' ? `prompt-${target.section}` : `studio-${target.section}`
}

type StackProps = {
  assistant: AssistantSummary
  services: AssistantService[]
  promptDirty: boolean
  /** The drawer's current target, or null when it's closed. */
  active: ConfigTarget | null
  /** The service whose subsections are listed (the open one, or the first live one). */
  focusService: AssistantService
  onOpen: (target: ConfigTarget) => void
}

/**
 * The top of the side panel: the assistant's settings as a stack, drawn with the same parts as the
 * canvas's "add" groups. Each row opens the drawer at that subsection.
 */
export function ConfigStack({ assistant, services, promptDirty, active, focusService, onOpen }: StackProps) {
  const live = (service: AssistantService) => assistant.inUse.includes(service)
  const isActive = (target: ConfigTarget) =>
    Boolean(
      active &&
        active.group === target.group &&
        (active.group === 'prompt' || (target.group === 'behaviour' && active.service === target.service)) &&
        (target.section === undefined || active.section === target.section),
    )
  const promptValues: Record<(typeof PROMPT_SECTIONS)[number]['id'], string> = {
    language: assistant.language === 'bn' ? 'বাংলা' : 'English',
    'first-message': `${assistant.firstMessage.length} chars`,
    system: `≈ ${estimateTokens(assistant.systemPrompt || '').toLocaleString()} tokens`,
  }

  return (
    <>
      <p className="wb-stack-label">Configure</p>
      <details className="wb-app" open>
        <summary>
          <span className="wb-app-mark" aria-hidden>
            P
          </span>
          <strong>Prompt</strong>
          <small data-warn={promptDirty}>{promptDirty ? 'unsaved' : 'shared'}</small>
        </summary>
        <div className="wb-actions">
          {PROMPT_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              data-active={isActive({ group: 'prompt', section: section.id })}
              onClick={() => onOpen({ group: 'prompt', section: section.id })}
            >
              <span>
                {section.label}
                <small>{promptValues[section.id]}</small>
              </span>
              <b aria-hidden>›</b>
            </button>
          ))}
        </div>
      </details>

      <details className="wb-app" open>
        <summary>
          <span className="wb-app-mark" aria-hidden>
            B
          </span>
          <strong>Behaviour</strong>
          <small>{assistant.inUse.length} live</small>
        </summary>
        <div className="wb-actions">
          {services.map((service) => {
            const focused = service === focusService
            return (
              <div key={service}>
                <button
                  type="button"
                  data-active={isActive({ group: 'behaviour', service })}
                  onClick={() => onOpen({ group: 'behaviour', service })}
                  aria-label={`${ASSISTANT_SERVICE_META[service].label} behaviour, ${live(service) ? 'live' : 'off'}`}
                >
                  <i className="wb-dot" data-on={live(service)} aria-hidden />
                  <span>
                    {ASSISTANT_SERVICE_META[service].label}
                    <small>{live(service) ? 'live' : 'off'}</small>
                  </span>
                  <b aria-hidden>›</b>
                </button>
                {focused ? (
                  <div className="wb-subs" aria-label={`${ASSISTANT_SERVICE_META[service].label} sections`}>
                    {SERVICE_SECTIONS[service].map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        data-active={isActive({ group: 'behaviour', service, section: section.id })}
                        onClick={() => onOpen({ group: 'behaviour', service, section: section.id })}
                      >
                        {section.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </details>
    </>
  )
}

type DrawerProps = {
  open: boolean
  target: ConfigTarget
  /** Bumped on every open so re-picking the same subsection scrolls to it again. */
  nonce: number
  live: boolean
  pending: boolean
  onUseFor: (service: AssistantService) => void
  onSection: (section: string) => void
  onClose: () => void
  prompt: ReactNode
  behaviour: ReactNode
}

/**
 * The editor that slides over the canvas (the config stack stays visible beside it). Both editors
 * stay mounted while it's closed, so unsaved edits survive closing it.
 */
export function ConfigDrawer({ open, target, nonce, live, pending, onUseFor, onSection, onClose, prompt, behaviour }: DrawerProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const isPrompt = target.group === 'prompt'
  const service = target.group === 'behaviour' ? target.service : null
  const sections = isPrompt ? PROMPT_SECTIONS : SERVICE_SECTIONS[service!]
  const title = isPrompt ? 'Prompt' : ASSISTANT_SERVICE_META[service!].label
  const mark = isPrompt ? 'P' : ASSISTANT_SERVICE_META[service!].label.charAt(0)

  // Open: focus the title, then bring the picked subsection into view and flash it once.
  useEffect(() => {
    if (!open) return
    headingRef.current?.focus({ preventScroll: true })
    const id = anchorId(target)
    const body = bodyRef.current
    if (!body) return
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const element = id ? (body.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null) : null
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (!element) {
          body.scrollTo({ top: 0 })
          return
        }
        // Prompt sections sit under the prompt's sticky save bar.
        const offset = isPrompt && target.section !== 'language' ? 64 : 12
        const top = element.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - offset
        body.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' })
        if (!reduce) {
          element.animate(
            [{ boxShadow: '0 0 0 2px oklch(0.68 0.19 293 / 0.65)' }, { boxShadow: '0 0 0 2px oklch(0.68 0.19 293 / 0)' }],
            { duration: 1400, easing: 'ease-out' },
          )
        }
      })
    })
    return () => cancelAnimationFrame(frame)
    // nonce re-runs this for a repeat pick of the same target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, nonce])

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="config-drawer-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.stopPropagation()
          onClose()
        }
      }}
      className={cn(
        'absolute inset-0 flex flex-col border-r border-border bg-card shadow-[0_0_60px_-20px_rgb(0_0_0/0.8)] transition-[opacity,transform,visibility] duration-200 ease-out motion-reduce:transition-none',
        open ? 'visible translate-x-0 opacity-100' : 'invisible translate-x-3 opacity-0',
      )}
    >
      <header className="flex flex-none items-center gap-3 border-b border-border px-4 py-3">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border border-violet-400/50 bg-violet-500/15 text-[13px] font-bold text-violet-200"
          aria-hidden
        >
          {mark}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="config-drawer-title" ref={headingRef} tabIndex={-1} className="truncate text-sm font-semibold outline-none">
            {title}
          </h2>
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {isPrompt ? 'Prompt · shared by every service' : `Behaviour · ${live ? 'live' : 'off'}`}
          </p>
        </div>
        {service ? (
          live ? (
            <Link
              href={ASSISTANT_SERVICE_META[service].servicePath}
              className="hidden h-8 items-center gap-1 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 sm:flex"
            >
              Look &amp; website code
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          ) : service !== 'tour' ? (
            <Button size="sm" variant="outline" className="h-8" disabled={pending} onClick={() => onUseFor(service)}>
              {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Use for {ASSISTANT_SERVICE_META[service].label}
            </Button>
          ) : null
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close editor"
          title="Close (Esc)"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <nav aria-label={`${title} sections`} className="flex flex-none gap-1 overflow-x-auto border-b border-border px-4 py-2">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => onSection(section.id)}
            aria-current={target.section === section.id ? 'true' : undefined}
            className={cn(
              'shrink-0 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors',
              target.section === section.id
                ? 'border-violet-400/70 bg-violet-500/15 text-foreground'
                : 'border-border text-muted-foreground hover:border-violet-400/40 hover:text-foreground',
            )}
          >
            {section.label}
          </button>
        ))}
      </nav>

      {/* The editors carry their own "On this page" chips; the drawer's tabs above replace them. */}
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto [&_nav[aria-label='On_this_page']]:hidden">
        <div hidden={!isPrompt} className="mx-auto w-full max-w-3xl px-4 pb-10 pt-1 sm:px-6">
          {prompt}
        </div>
        <div hidden={isPrompt} className="mx-auto w-full max-w-3xl px-4 py-5 pb-10 sm:px-6">
          {behaviour}
        </div>
      </div>
    </div>
  )
}
