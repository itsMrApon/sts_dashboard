import { Prisma } from '@prisma/client'
import { auth } from '@trigger.dev/sdk'
import { prismaClient } from '@/lib/prismaClient'
import { decryptToken, encryptToken } from '@/lib/messages/encrypt'

/**
 * The trigger.dev project that runs sts-ai's background jobs. The secret key is saved by a
 * platform owner in /integrations/trigger and falls back to TRIGGER_SECRET_KEY. The app uses it
 * to start jobs; the jobs themselves run on trigger.dev with the env vars set in its dashboard.
 */

const SECRET_KEY = 'trigger.secretKey'
const PROJECT_REF = 'trigger.projectRef'

export type TriggerEnvironment = 'development' | 'staging' | 'production' | 'preview' | 'unknown'

export type TriggerSettings = {
  /** Where the secret key comes from: saved in /integrations, the env var, or nowhere. */
  source: 'saved' | 'env' | 'none'
  environment: TriggerEnvironment | null
  /** Last four characters, so the owner can tell keys apart without seeing them. */
  keyHint: string | null
  projectRef: string | null
  /** The settings table has not been migrated yet. */
  storageMissing: boolean
}

/** trigger.dev keys say their environment in the prefix: tr_dev_, tr_stg_, tr_prod_, tr_preview_. */
export function triggerEnvironment(secretKey: string): TriggerEnvironment {
  if (secretKey.startsWith('tr_dev_')) return 'development'
  if (secretKey.startsWith('tr_stg_')) return 'staging'
  if (secretKey.startsWith('tr_prod_')) return 'production'
  if (secretKey.startsWith('tr_preview_')) return 'preview'
  return 'unknown'
}

export function isTriggerSecretKey(value: string): boolean {
  return /^tr_(dev|stg|prod|preview)_[A-Za-z0-9_-]{8,}$/.test(value)
}

function isMissingTable(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2021'
}

async function readSavedValues(): Promise<{ values: Map<string, string>; storageMissing: boolean }> {
  try {
    const rows = await prismaClient.platformSetting.findMany({ where: { key: { in: [SECRET_KEY, PROJECT_REF] } } })
    const values = new Map<string, string>()
    for (const row of rows) {
      const plain = decryptToken(row.valueEnc)
      if (plain) values.set(row.key, plain)
    }
    return { values, storageMissing: false }
  } catch (err) {
    if (isMissingTable(err)) return { values: new Map(), storageMissing: true }
    throw err
  }
}

/** The secret key to start jobs with, or null when none is set anywhere. */
export async function resolveTriggerSecretKey(): Promise<string | null> {
  const { values } = await readSavedValues()
  return values.get(SECRET_KEY) ?? (process.env.TRIGGER_SECRET_KEY?.trim() || null)
}

export async function loadTriggerSettings(): Promise<TriggerSettings> {
  const { values, storageMissing } = await readSavedValues()
  const saved = values.get(SECRET_KEY)
  const fromEnv = process.env.TRIGGER_SECRET_KEY?.trim() || null
  const key = saved ?? fromEnv
  return {
    source: saved ? 'saved' : fromEnv ? 'env' : 'none',
    environment: key ? triggerEnvironment(key) : null,
    keyHint: key ? key.slice(-4) : null,
    projectRef: values.get(PROJECT_REF) ?? (process.env.TRIGGER_PROJECT_REF?.trim() || null),
    storageMissing,
  }
}

async function upsertSetting(key: string, value: string, userId: string) {
  const valueEnc = encryptToken(value)
  await prismaClient.platformSetting.upsert({
    where: { key },
    create: { key, valueEnc, updatedByUserId: userId },
    update: { valueEnc, updatedByUserId: userId },
  })
}

/** Saves what the owner typed. Blank fields keep the current value. */
export async function saveTriggerSettings(input: { secretKey?: string; projectRef?: string; userId: string }) {
  if (input.secretKey) await upsertSetting(SECRET_KEY, input.secretKey, input.userId)
  if (input.projectRef) await upsertSetting(PROJECT_REF, input.projectRef, input.userId)
}

export async function clearSavedTriggerSettings() {
  await prismaClient.platformSetting.deleteMany({ where: { key: { in: [SECRET_KEY, PROJECT_REF] } } })
}

/** Runs trigger.dev SDK calls (tasks.trigger, runs.list, ...) with the platform's key. */
export async function withTriggerAuth<T>(fn: () => Promise<T>, secretKey?: string): Promise<T> {
  const accessToken = secretKey ?? (await resolveTriggerSecretKey())
  if (!accessToken) throw new Error('trigger.dev is not connected. Add the secret key in Integrations.')
  return auth.withAuth({ accessToken }, fn)
}
