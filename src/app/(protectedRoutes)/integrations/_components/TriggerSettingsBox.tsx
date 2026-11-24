'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ExternalLink, Play, PlugZap } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  clearTriggerDevSettings,
  runDailyLeadJobsNow,
  saveTriggerDevSettings,
  testTriggerDevConnection,
} from '@/actions/triggerDev'
import type { TriggerSettings } from '@/lib/jobs/triggerSettings'
import { guardAction } from '@/lib/clientActionErrors'

const ENV_LABEL: Record<string, string> = {
  development: 'Development',
  staging: 'Staging',
  production: 'Production',
  preview: 'Preview',
  unknown: 'Unknown environment',
}

/** Env vars the jobs need in the trigger.dev project (its dashboard → Environment variables). */
const JOB_ENV_VARS = [
  'DATABASE_URL',
  'ENCRYPTION_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'NEXT_PUBLIC_APP_URL',
  'SCRAPE_AGENT_URL',
  'SCRAPE_AGENT_API_KEY',
]

export function TriggerSettingsBox({ settings }: { settings: TriggerSettings }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [secretKey, setSecretKey] = useState('')
  const [projectRef, setProjectRef] = useState('')
  const [lastRunId, setLastRunId] = useState<string | null>(null)
  const connected = settings.source !== 'none'

  const run = (action: () => ReturnType<typeof testTriggerDevConnection>, fallback: string, after?: (runId?: string) => void) =>
    startTransition(
      guardAction(async () => {
        const result = await action()
        if (result.ok) {
          toast.success(result.message ?? fallback)
          after?.(result.runId)
          router.refresh()
        } else toast.error(result.error)
      }),
    )

  const dashboardUrl = settings.projectRef ? `https://cloud.trigger.dev/projects/v3/${settings.projectRef}` : 'https://cloud.trigger.dev'

  return (
    <div className="space-y-4">
      {settings.storageMissing ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          The settings table isn&apos;t in the database yet, so keys can&apos;t be saved here. Run the latest Prisma
          migration (<code className="font-mono text-xs">platform_settings</code>) on your dev branch first.
        </p>
      ) : null}

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-medium">Connection</h2>
            <p className="text-muted-foreground text-sm">The secret key lets sts-ai start jobs in your trigger.dev project.</p>
          </div>
          <Badge variant={connected ? 'secondary' : 'outline'}>
            {settings.source === 'saved' ? 'Saved here' : settings.source === 'env' ? 'From env' : 'Not set'}
          </Badge>
        </div>

        {connected ? (
          <p className="text-sm">
            {ENV_LABEL[settings.environment ?? 'unknown']} key ending in{' '}
            <span className="font-mono">{settings.keyHint}</span>
            {settings.projectRef ? (
              <>
                {' '}· project <span className="font-mono">{settings.projectRef}</span>
              </>
            ) : null}
          </p>
        ) : null}

        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (!secretKey.trim() && !projectRef.trim()) {
              toast.error('Paste a secret key or a project ref first.')
              return
            }
            run(() => saveTriggerDevSettings({ secretKey, projectRef }), 'trigger.dev saved', () => {
              setSecretKey('')
              setProjectRef('')
            })
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="trigger-secret">Secret key</Label>
            <Input
              id="trigger-secret"
              type="password"
              autoComplete="off"
              placeholder={connected ? 'Leave blank to keep the current key' : 'tr_dev_… or tr_prod_…'}
              value={secretKey}
              onChange={(event) => setSecretKey(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="trigger-project">Project ref</Label>
            <Input
              id="trigger-project"
              autoComplete="off"
              placeholder={settings.projectRef ?? 'proj_…'}
              value={projectRef}
              onChange={(event) => setProjectRef(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" type="submit" variant="secondary" disabled={pending || settings.storageMissing}>
              Save
            </Button>
            {settings.source === 'saved' ? (
              <Button
                size="sm"
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => run(() => clearTriggerDevSettings(), 'Saved keys cleared')}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <div>
          <h2 className="font-medium">Jobs</h2>
          <p className="text-muted-foreground text-sm">
            The daily lead jobs run on their own at 01:00 UTC. Start them now to test, or to catch up after a change.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !connected}
            onClick={() => run(() => testTriggerDevConnection(), 'Connected')}
          >
            <PlugZap className="mr-1.5 size-4" aria-hidden />
            Test connection
          </Button>
          <Button
            size="sm"
            disabled={pending || !connected}
            onClick={() => run(() => runDailyLeadJobsNow(), 'Jobs started', (runId) => setLastRunId(runId ?? null))}
          >
            <Play className="mr-1.5 size-4" aria-hidden />
            Run now
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <a href={dashboardUrl} target="_blank" rel="noopener noreferrer">
              Open trigger.dev
              <ExternalLink className="ml-1.5 size-3.5" aria-hidden />
            </a>
          </Button>
        </div>
        {lastRunId ? (
          <p className="text-muted-foreground text-sm">
            Started run <span className="font-mono">{lastRunId}</span>. Follow it in the trigger.dev dashboard.
          </p>
        ) : null}
      </section>

      <section className="space-y-2 rounded-xl border bg-card p-5 text-sm">
        <h2 className="font-medium">Setup checklist</h2>
        <ol className="text-muted-foreground list-decimal space-y-1.5 pl-5">
          <li>Create a project at trigger.dev and copy its secret key and project ref here.</li>
          <li>
            In the project&apos;s Environment variables, add:{' '}
            {JOB_ENV_VARS.map((name, index) => (
              <span key={name}>
                <code className="font-mono text-xs">{name}</code>
                {index < JOB_ENV_VARS.length - 1 ? ', ' : ''}
              </span>
            ))}
            . The jobs run on trigger.dev&apos;s servers, so <code className="font-mono text-xs">SCRAPE_AGENT_URL</code>{' '}
            must be a public address, not localhost.
          </li>
          <li>
            Put the project ref in <code className="font-mono text-xs">TRIGGER_PROJECT_REF</code> on the machine you
            deploy from, then run <code className="font-mono text-xs">npm run trigger:deploy</code>. For a development
            key, keep <code className="font-mono text-xs">npm run trigger:dev</code> running instead.
          </li>
        </ol>
      </section>
    </div>
  )
}
