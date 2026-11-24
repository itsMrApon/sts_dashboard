'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { ExternalLink, Play, PlugZap } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { setJobRunner, testInngestWorker } from '@/actions/jobRunner'
import { runDailyLeadJobsNow } from '@/actions/triggerDev'
import type { InngestStatus, JobProvider } from '@/lib/jobs/jobProvider'
import { guardAction } from '@/lib/clientActionErrors'
import { cn } from '@/lib/utils'

type Props = {
  active: JobProvider
  triggerReady: boolean
  triggerEnvironment: string | null
  inngest: InngestStatus
}

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`
}

/**
 * Which system runs the background jobs. Both stay set up; the switch decides which one does the
 * work, so if one fails (trigger.dev deploys, an Inngest outage) the other takes over at the next run.
 */
export function JobRunnerBox({ active, triggerReady, triggerEnvironment, inngest }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const inngestReady = inngest.canSend && inngest.workerKeySet

  const run = (action: () => ReturnType<typeof setJobRunner>) =>
    startTransition(
      guardAction(async () => {
        const result = await action()
        if (result.ok) toast.success(result.message ?? 'Done')
        else toast.error(result.error)
        router.refresh()
      }),
    )

  const runners: { id: JobProvider; name: string; ready: boolean; detail: string; href: string }[] = [
    {
      id: 'trigger',
      name: 'trigger.dev',
      ready: triggerReady,
      detail: triggerReady
        ? `Key set (${triggerEnvironment ?? 'unknown'}). Jobs run on trigger.dev once deployed with npm run trigger:deploy.`
        : 'No key yet: add it below.',
      href: 'https://cloud.trigger.dev',
    },
    {
      id: 'inngest',
      name: 'Inngest',
      ready: inngestReady,
      detail: inngestReady
        ? `${inngest.dev ? 'Local dev server. ' : ''}Jobs run in the sts-jobs-worker container on your server.${
            inngest.lastPingAt ? ` Worker last answered ${timeAgo(inngest.lastPingAt)}.` : ' Not tested yet.'
          }`
        : `Missing ${[!inngest.canSend && 'INNGEST_EVENT_KEY', !inngest.workerKeySet && 'INNGEST_SIGNING_KEY'].filter(Boolean).join(' and ')} in .env.production.`,
      href: 'https://app.inngest.com',
    },
  ]

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="font-medium">Job runner</h2>
        <p className="text-sm text-muted-foreground">
          Reminders, review requests, the morning summary, cleanup, Instagram DMs, lead intel and Questions run on the one you pick.
          The other stays ready as a backup.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {runners.map((runner) => {
          const isActive = active === runner.id
          return (
            <div key={runner.id} className={cn('flex flex-col gap-2 rounded-lg border p-4', isActive && 'border-primary ring-1 ring-primary')}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{runner.name}</p>
                {isActive ? <Badge>Active</Badge> : runner.ready ? <Badge variant="secondary">Ready</Badge> : <Badge variant="outline">Not set up</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{runner.detail}</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                {!isActive ? (
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setJobRunner(runner.id))}>
                    Make active
                  </Button>
                ) : null}
                {runner.id === 'inngest' ? (
                  <Button size="sm" variant="outline" disabled={pending || !inngestReady} onClick={() => run(testInngestWorker)}>
                    <PlugZap className="mr-1.5 size-4" aria-hidden />
                    {pending ? 'Waiting for the worker…' : 'Test worker'}
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" asChild>
                  <a href={runner.href} target="_blank" rel="noopener noreferrer">
                    Dashboard
                    <ExternalLink className="ml-1.5 size-3.5" aria-hidden />
                  </a>
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <Button size="sm" disabled={pending} onClick={() => run(runDailyLeadJobsNow)}>
          <Play className="mr-1.5 size-4" aria-hidden />
          Run lead jobs now
        </Button>
        <p className="text-xs text-muted-foreground">
          Starts today&apos;s lead intel on {active === 'inngest' ? 'Inngest' : 'trigger.dev'} instead of waiting for 01:00 UTC.
        </p>
      </div>
    </section>
  )
}
