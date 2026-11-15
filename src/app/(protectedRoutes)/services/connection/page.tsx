import { headers } from 'next/headers'
import { KeyRound, Terminal } from 'lucide-react'
import { WebsiteKeyCard } from '@/components/services/connection/WebsiteKeyCard'
import { CodeWalkthrough } from '@/components/services/studio/CodeWalkthrough'
import { connectionGuide } from '@/lib/services/snippets'
import { loadServicesContext } from '../_lib/servicesContext'
import { ServicesShell } from '../_components/ServicesShell'

async function appOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  const list = await headers()
  const host = list.get('x-forwarded-host') ?? list.get('host') ?? 'localhost:3000'
  const proto = list.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

/** Services → Connection: the one website every service runs on, its key, and the one-time SDK setup. */
export default async function ConnectionPage() {
  const [{ business }, origin] = await Promise.all([loadServicesContext(), appOrigin()])

  return (
    <ServicesShell title="Connection">
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-border/80 bg-card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-medium">
            <KeyRound className="h-4 w-4 text-amber-500" aria-hidden />
            Website & key
          </h2>
          <WebsiteKeyCard roomName={business.roomName} />
        </section>
        <section className="min-w-0 space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Terminal className="h-4 w-4 text-muted-foreground" aria-hidden />
            Set up once
          </h2>
          <CodeWalkthrough steps={connectionGuide(origin)} />
        </section>
      </div>
    </ServicesShell>
  )
}
