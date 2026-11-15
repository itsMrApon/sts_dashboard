import type { ReactNode } from 'react'
import Link from 'next/link'
import { Globe2 } from 'lucide-react'
import { WebsiteConnectionProvider } from '@/components/services/connection/WebsiteConnection'
import { cn } from '@/lib/utils'
import { loadServicesContext } from '../_lib/servicesContext'
import { ServicesSubnav } from './ServicesSubnav'

type Props = {
  title: string
  actions?: ReactNode
  children: ReactNode
}

function hostOf(origin: string): string {
  try {
    return new URL(origin).host
  } catch {
    return origin
  }
}

/** Header + section nav shared by every /services page, and the website-connection gate. */
export async function ServicesShell({ title, actions, children }: Props) {
  const { business, connection } = await loadServicesContext()

  return (
    <WebsiteConnectionProvider roomName={business.roomName} initial={connection}>
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-col gap-4 border-b border-border pb-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-medium uppercase tracking-widest text-primary">{business.name}</p>
                <Link
                  href="/services/connection"
                  className={cn(
                    'flex max-w-[220px] items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                    connection.connected
                      ? 'border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400'
                      : 'border-amber-500/40 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400',
                  )}
                >
                  <Globe2 className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="truncate">{connection.origin ? hostOf(connection.origin) : 'Connect website'}</span>
                </Link>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            </div>
            {actions}
          </div>
          <ServicesSubnav />
        </div>
        {children}
      </div>
    </WebsiteConnectionProvider>
  )
}
