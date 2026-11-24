'use server'

import { runs, tasks } from '@trigger.dev/sdk'
import { revalidatePath } from 'next/cache'
import { onAuthenticateUser } from '@/actions/auth'
import {
  clearSavedTriggerSettings,
  isTriggerSecretKey,
  loadTriggerSettings,
  saveTriggerSettings,
  withTriggerAuth,
} from '@/lib/jobs/triggerSettings'
import { isPlatformOwner } from '@/lib/platform/platformOwner'
import { activeJobProvider } from '@/lib/jobs/jobProvider'
import { JOB_EVENTS } from '@/inngest/client'
import { sendInngestEvent } from '@/lib/jobs/inngestEvents'
import type { leadIntelRunAll } from '@/trigger/leadIntel'

type Result = { ok: true; message?: string; runId?: string } | { ok: false; error: string }

const TRIGGER_TIMEOUT_MS = 15_000

/** Platform settings: only owners listed in OWNER_EMAILS may read or change them. */
async function requireOwner(): Promise<{ userId: string } | null> {
  const authResult = await onAuthenticateUser()
  if (!authResult.user || !isPlatformOwner(authResult.user.email)) return null
  return { userId: authResult.user.id }
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} took too long. Try again.`)), TRIGGER_TIMEOUT_MS)),
  ])
}

function errorText(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err)
  if (/401|unauthori[sz]ed|invalid api key/i.test(text)) return 'trigger.dev did not accept that key. Copy it again from API keys in your project.'
  return text
}

export async function saveTriggerDevSettings(input: { secretKey: string; projectRef: string }): Promise<Result> {
  const owner = await requireOwner()
  if (!owner) return { ok: false, error: 'Only platform owners can change trigger.dev.' }
  const secretKey = input.secretKey.trim()
  const projectRef = input.projectRef.trim()
  if (!secretKey && !projectRef) return { ok: false, error: 'Paste a secret key or a project ref first.' }
  if (secretKey && !isTriggerSecretKey(secretKey)) {
    return { ok: false, error: 'That is not a trigger.dev secret key. It starts with tr_dev_ or tr_prod_.' }
  }
  if (projectRef && !/^proj_[a-z0-9]{6,}$/i.test(projectRef)) {
    return { ok: false, error: 'The project ref starts with proj_. Find it in your project settings.' }
  }
  if ((await loadTriggerSettings()).storageMissing) {
    return { ok: false, error: 'The settings table is not in the database yet. Run the latest Prisma migration first.' }
  }
  await saveTriggerSettings({ secretKey: secretKey || undefined, projectRef: projectRef || undefined, userId: owner.userId })
  revalidatePath('/integrations/trigger')
  return { ok: true }
}

export async function clearTriggerDevSettings(): Promise<Result> {
  const owner = await requireOwner()
  if (!owner) return { ok: false, error: 'Only platform owners can change trigger.dev.' }
  await clearSavedTriggerSettings()
  revalidatePath('/integrations/trigger')
  return { ok: true }
}

/** Calls trigger.dev with the key and reports which environment it opens. */
export async function testTriggerDevConnection(): Promise<Result> {
  const owner = await requireOwner()
  if (!owner) return { ok: false, error: 'Only platform owners can test trigger.dev.' }
  const settings = await loadTriggerSettings()
  if (settings.source === 'none') return { ok: false, error: 'Add a secret key first.' }
  try {
    await withTimeout(withTriggerAuth(() => runs.list({ limit: 1 }).then((page) => page.data)), 'trigger.dev')
    return { ok: true, message: `Connected to the ${settings.environment ?? 'unknown'} environment.` }
  } catch (err) {
    return { ok: false, error: errorText(err) }
  }
}

/** Starts the daily lead jobs now instead of waiting for 01:00 UTC, on the active job runner. */
export async function runDailyLeadJobsNow(): Promise<Result> {
  const owner = await requireOwner()
  if (!owner) return { ok: false, error: 'Only platform owners can start jobs.' }
  if ((await activeJobProvider()) === 'inngest') {
    try {
      await sendInngestEvent(JOB_EVENTS.leadIntelRunAll)
      return { ok: true, message: 'Daily lead jobs started on Inngest. Follow them in the Inngest dashboard.' }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Inngest did not accept the event.' }
    }
  }
  try {
    const handle = await withTimeout(
      withTriggerAuth(() => tasks.trigger<typeof leadIntelRunAll>('lead-intel-run-all', undefined)),
      'Starting the jobs',
    )
    const settings = await loadTriggerSettings()
    const where = settings.environment === 'development' ? ' It runs while `npm run trigger:dev` is open.' : ''
    return { ok: true, runId: handle.id, message: `Daily lead jobs started.${where}` }
  } catch (err) {
    return { ok: false, error: errorText(err) }
  }
}
