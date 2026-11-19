import Link from 'next/link'
import type { ReactNode } from 'react'
import { ClipboardList, Compass, Globe, MessageCircle, Mic, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PublicServiceKind, PublicServiceLinks } from '@/lib/public/publicService'

type LinkKind = keyof PublicServiceLinks

const SERVICE_META: Record<LinkKind, { label: string; icon: LucideIcon; dashboard: string }> = {
  chat: { label: 'Chat', icon: MessageCircle, dashboard: '/services/chat' },
  speak: { label: 'Speak', icon: Mic, dashboard: '/services/speak' },
  form: { label: 'Form', icon: ClipboardList, dashboard: '/services/form' },
  business: { label: 'Business', icon: Globe, dashboard: '/services/menu' },
  wizard: { label: 'Tour', icon: Compass, dashboard: '/services/wizard' },
}

const LINK_ORDER: LinkKind[] = ['business', 'chat', 'speak', 'form', 'wizard']

type Props = {
  businessName: string
  service: PublicServiceKind
  links: PublicServiceLinks
  /** Owner viewing a service that is switched off. */
  ownerPreview?: boolean
  /** Wide pages (business site) skip the centered column. */
  wide?: boolean
  /** Rendered inside a box (the dashboard's live view) instead of filling the viewport. */
  embedded?: boolean
  children: ReactNode
}

/**
 * Shared frame for the public service pages (/chat, /speak, /form, /business). Always dark —
 * the same look as the Speak and Wizard previews in the dashboard — regardless of app theme.
 */
export function PublicServiceShell({ businessName, service, links, ownerPreview, wide, embedded, children }: Props) {
  const otherLinks = LINK_ORDER.filter((kind) => kind !== service && links[kind])
  const meta = SERVICE_META[service]

  const page = (
    <div className={cn('relative flex flex-col', embedded ? 'min-h-full' : 'min-h-dvh')}>
      {ownerPreview && !embedded ? (
        <div className="relative z-10 bg-amber-400 px-4 py-1.5 text-center text-xs font-medium text-black">
          Only you can see this. {meta.label} is off —{' '}
          <Link href={meta.dashboard} className="underline underline-offset-2">
            turn it on
          </Link>{' '}
          to share it.
        </div>
      ) : null}

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 pt-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold">
            {businessName.trim().charAt(0).toUpperCase() || 'S'}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{businessName}</p>
            <p className="flex items-center gap-1 text-[11px] text-zinc-400">
              <meta.icon className="h-3 w-3" aria-hidden />
              {meta.label}
            </p>
          </div>
        </div>
        {otherLinks.length > 0 ? (
          <nav aria-label="More ways to reach us" className="flex items-center gap-1">
            {otherLinks.map((kind) => {
              const item = SERVICE_META[kind]
              return (
                <Link
                  key={kind}
                  href={links[kind]!}
                  title={item.label}
                  className="flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <item.icon className="h-3.5 w-3.5" aria-hidden />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        ) : null}
      </header>

      <main
        className={cn(
          'relative z-10 mx-auto flex w-full flex-1 flex-col px-4 py-6 sm:px-6',
          wide ? 'max-w-5xl' : 'max-w-xl justify-center',
        )}
      >
        {children}
      </main>

      <footer className="relative z-10 pb-5 text-center text-[11px] text-zinc-500">Powered by STS AI</footer>
    </div>
  )

  return (
    <div className={cn('relative bg-[#05060f] text-zinc-50', embedded && 'h-full overflow-hidden')}>
      <div
        aria-hidden
        className={cn(
          'pointer-events-none inset-0 -z-0 bg-[radial-gradient(60%_45%_at_20%_0%,rgba(139,92,246,0.22),transparent),radial-gradient(50%_40%_at_90%_10%,rgba(56,189,248,0.14),transparent)]',
          embedded ? 'absolute' : 'fixed',
        )}
      />
      {embedded ? <div className="relative h-full overflow-y-auto overscroll-contain">{page}</div> : page}
    </div>
  )
}

/** Shown when a service is switched off (or the business has none). */
export function ServiceUnavailable({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-1.5 text-sm text-zinc-400">{detail}</p>
    </div>
  )
}

/** Glass card used by the service pages. */
export function ServiceCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/40 backdrop-blur', className)}>
      {children}
    </div>
  )
}
