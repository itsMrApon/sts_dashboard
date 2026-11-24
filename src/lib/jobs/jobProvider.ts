import { prismaClient } from '@/lib/prismaClient'
import { decryptToken, encryptToken } from '@/lib/messages/encrypt'

/**
 * Which system runs sts-ai's background jobs: trigger.dev or Inngest. Both can be live at the
 * same time; every scheduled job asks this first and skips when the other one is active, so
 * switching (Integrations → trigger.dev, platform owners) never runs a job twice.
 * Read by the web app, the trigger.dev tasks and the Inngest worker.
 */

export type JobProvider = 'trigger' | 'inngest'

const PROVIDER_KEY = 'jobs.provider'
const INNGEST_PING_KEY = 'jobs.inngest.lastPing'
const DEFAULT_PROVIDER: JobProvider = 'trigger'

async function readSetting(key: string): Promise<string | null> {
  const row = await prismaClient.platformSetting.findUnique({ where: { key } })
  return row ? decryptToken(row.valueEnc) : null
}

async function writeSetting(key: string, value: string, userId: string | null) {
  const valueEnc = encryptToken(value)
  await prismaClient.platformSetting.upsert({
    where: { key },
    create: { key, valueEnc, updatedByUserId: userId },
    update: { valueEnc, updatedByUserId: userId },
  })
}

export async function activeJobProvider(): Promise<JobProvider> {
  try {
    return (await readSetting(PROVIDER_KEY)) === 'inngest' ? 'inngest' : DEFAULT_PROVIDER
  } catch (error) {
    // A database hiccup must not let both systems run the same job: only the default runs.
    console.warn('[jobs] could not read the active job provider; assuming', DEFAULT_PROVIDER, error)
    return DEFAULT_PROVIDER
  }
}

export async function isActiveJobProvider(provider: JobProvider): Promise<boolean> {
  return (await activeJobProvider()) === provider
}

export async function setActiveJobProvider(provider: JobProvider, userId: string): Promise<void> {
  await writeSetting(PROVIDER_KEY, provider, userId)
}

/** The Inngest worker answers a ping by writing the time, so the owner can see it is connected. */
export async function recordInngestPing(): Promise<string> {
  const at = new Date().toISOString()
  await writeSetting(INNGEST_PING_KEY, at, null)
  return at
}

export type InngestStatus = {
  /** The app can send events (INNGEST_EVENT_KEY, or the local dev server). */
  canSend: boolean
  /** The worker can connect (INNGEST_SIGNING_KEY, or the local dev server). */
  workerKeySet: boolean
  dev: boolean
  /** When the worker last answered a ping. */
  lastPingAt: string | null
}

export async function loadInngestStatus(): Promise<InngestStatus> {
  const dev = process.env.INNGEST_DEV === '1'
  return {
    canSend: dev || Boolean(process.env.INNGEST_EVENT_KEY?.trim()),
    workerKeySet: dev || Boolean(process.env.INNGEST_SIGNING_KEY?.trim()),
    dev,
    lastPingAt: await readSetting(INNGEST_PING_KEY).catch(() => null),
  }
}

/** The app's public address, for links in emails and Telegram, as both job systems see it. */
export function jobsAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/+$/, '')
}
