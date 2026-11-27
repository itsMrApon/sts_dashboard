'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import Riffle from '@/components/ui/hairline-riffle'
import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import { ConnectAgentButton } from '@/components/agent/ConnectAgentButton'
import { STS_CLI_VERSION } from '@/lib/social/library/buildPrompt'

export type HubStatus = { label: string; on: boolean }

/** The command that asks: connect the AI agent, set up the website, or both. */
const SETUP_COMMAND = `npx --yes @sts-ai/cli@${STS_CLI_VERSION} init`

export type ServiceKey = 'assistants' | 'chat' | 'speak' | 'form' | 'wizard' | 'menu' | 'docs' | 'links' | 'live' | 'contact'

/** The folders, front of the tray first: the assistants that run the services, then each service. */
const FOLDERS: { key: ServiceKey; label: string; hint: string; href: string }[] = [
  { key: 'assistants', label: 'AI assistants', hint: 'the AI that runs each service', href: '/ai-agents' },
  { key: 'chat', label: 'Chat AI', hint: 'text chat in your own chat box', href: '/services/chat' },
  { key: 'speak', label: 'Voice AI', hint: 'real-time voice calls with your AI', href: '/services/speak' },
  { key: 'form', label: 'Form', hint: 'callback and lead form, your design', href: '/services/form' },
  { key: 'wizard', label: 'Tour', hint: 'voice-guided tour of your website', href: '/services/wizard' },
  { key: 'menu', label: 'Menu', hint: 'your products and services, with order links', href: '/services/menu' },
  { key: 'docs', label: 'Docs', hint: 'forms and PDFs your customers need', href: '/services/docs' },
  { key: 'links', label: 'Links', hint: 'your socials and a link-in-bio page', href: '/services/links' },
  { key: 'live', label: 'Live', hint: 'upcoming webinars with a countdown', href: '/services/live' },
  { key: 'contact', label: 'Contact', hint: 'call, WhatsApp, map, hours and badges', href: '/services/contact' },
]

/**
 * /services: the same folder tray as /lead and /social, one folder per website service (plus the
 * AI assistants that run them), on a page that does not scroll, with Install over it.
 */
export function ServicesFolders({ status }: { status: Record<Exclude<ServiceKey, 'assistants'>, HubStatus> }) {
  const router = useRouter()
  const [pulled, setPulled] = useState<ServiceKey | null>(null)
  const folder = FOLDERS.find((f) => f.key === pulled) ?? null
  const statusOf = (key: ServiceKey): HubStatus | null => (key === 'assistants' ? null : status[key])

  return (
    <PageViewport bottomPad={16}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 justify-center">
          <ConnectAgentButton command={SETUP_COMMAND} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto overscroll-contain pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-full max-w-xl flex-col items-center">
            <Riffle
              aria-label="Your website services, as folders. Hover or use the arrow keys to pull one, then click or press Enter to open it."
              labels={FOLDERS.map((f) => f.label)}
              className="text-foreground w-full max-w-[min(28rem,50dvh)]"
              onRead={(text) => {
                const n = Number(text)
                setPulled(Number.isInteger(n) && n >= 1 ? (FOLDERS[n - 1]?.key ?? null) : null)
              }}
              onPick={(card) => {
                const picked = FOLDERS[card - 1]
                if (picked) router.push(picked.href)
              }}
            />

            <p className="text-muted-foreground -mt-2 min-h-5 text-center text-sm" aria-hidden="true">
              {folder ? (
                <>
                  <span className="text-foreground font-medium">{folder.label}</span> · {folder.hint}
                  {statusOf(folder.key) ? ` · ${statusOf(folder.key)!.label}` : ''}
                </>
              ) : (
                'Pull a folder to see what it opens'
              )}
            </p>

            {/* The same folders as links, for touch and keyboard. */}
            <ul className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Website services">
              {FOLDERS.map((f) => {
                const s = statusOf(f.key)
                return (
                  <li key={f.key}>
                    <Link
                      href={f.href}
                      onMouseEnter={() => setPulled(f.key)}
                      className={cn(
                        'border-border bg-background hover:bg-muted inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors',
                        'focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none',
                        pulled === f.key && 'border-foreground/40',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn('size-1.5 rounded-full', !s || s.on ? 'bg-emerald-500' : 'bg-muted-foreground/40')}
                      />
                      {f.label}
                      {s ? <span className="sr-only"> ({s.label})</span> : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>
    </PageViewport>
  )
}
