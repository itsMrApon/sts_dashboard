'use server'

import { revalidatePath } from 'next/cache'
import { onAuthenticateUser } from '@/actions/auth'
import { isPlatformOwner } from '@/lib/platform/platformOwner'
import { loadInngestStatus, setActiveJobProvider, type JobProvider } from '@/lib/jobs/jobProvider'
import { JOB_EVENTS } from '@/inngest/client'
import { sendInngestEvent } from '@/lib/jobs/inngestEvents'

type Result = { ok: true; message?: string } | { ok: false; error: string }

const PING_WAIT_MS = 12_000

async function requireOwner(): Promise<{ userId: string } | null> {
  const auth = await onAuthenticateUser()
  if (!auth.user || !isPlatformOwner(auth.user.email)) return null
  return { userId: auth.user.id }
}

/** Makes trigger.dev or Inngest the one that runs the scheduled jobs. Takes effect at the next run. */
export async function setJobRunner(provider: JobProvider): Promise<Result> {
  const owner = await requireOwner()
  if (!owner) return { ok: false, error: 'Only platform owners can change the job runner.' }
  if (provider !== 'trigger' && provider !== 'inngest') return { ok: false, error: 'Unknown job runner.' }
  await setActiveJobProvider(provider, owner.userId)
  revalidatePath('/integrations/trigger')
  revalidatePath('/integrations')
  return { ok: true, message: `${provider === 'inngest' ? 'Inngest' : 'trigger.dev'} now runs the jobs, from the next scheduled run.` }
}

/** Sends a ping and waits for the worker to write back: proves Inngest, the worker and the database. */
export async function testInngestWorker(): Promise<Result> {
  const owner = await requireOwner()
  if (!owner) return { ok: false, error: 'Only platform owners can test the worker.' }
  const before = (await loadInngestStatus()).lastPingAt
  try {
    await sendInngestEvent(JOB_EVENTS.ping)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Inngest did not accept the event.' }
  }
  const deadline = Date.now() + PING_WAIT_MS
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1_000))
    const now = (await loadInngestStatus()).lastPingAt
    if (now && now !== before) {
      revalidatePath('/integrations/trigger')
      return { ok: true, message: 'The worker answered. Inngest is ready.' }
    }
  }
  return { ok: false, error: 'Inngest took the event, but the worker did not answer. Check that the sts-jobs-worker container is running and connected.' }
}
