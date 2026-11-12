import 'server-only'
import type { UserVoiceCredential } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'

/**
 * Account-wide provider API keys (encrypted at rest). "Voice" is historical: this table now
 * holds every LLM/STT/TTS key the Config Agent page manages.
 */
export type VoiceCredentialProvider =
  | 'google'
  | 'deepgram'
  | 'openai'
  | 'anthropic'
  | 'openrouter'
  | 'xai'
  | 'fish'
  | 'deepseek'
  | 'kimi'

export type UserVoiceCredentialRow = UserVoiceCredential

type KeyColumn =
  | 'googleApiKey'
  | 'deepgramApiKey'
  | 'openaiApiKey'
  | 'anthropicApiKey'
  | 'openrouterApiKey'
  | 'xaiApiKey'
  | 'fishApiKey'
  | 'deepseekApiKey'
  | 'kimiApiKey'

type ValidatedAtColumn =
  | 'googleValidatedAt'
  | 'deepgramValidatedAt'
  | 'openaiValidatedAt'
  | 'anthropicValidatedAt'
  | 'openrouterValidatedAt'
  | 'xaiValidatedAt'
  | 'fishValidatedAt'
  | 'deepseekValidatedAt'
  | 'kimiValidatedAt'

export const CREDENTIAL_COLUMNS: Record<
  VoiceCredentialProvider,
  { key: KeyColumn; validatedAt: ValidatedAtColumn }
> = {
  google: { key: 'googleApiKey', validatedAt: 'googleValidatedAt' },
  deepgram: { key: 'deepgramApiKey', validatedAt: 'deepgramValidatedAt' },
  openai: { key: 'openaiApiKey', validatedAt: 'openaiValidatedAt' },
  anthropic: { key: 'anthropicApiKey', validatedAt: 'anthropicValidatedAt' },
  openrouter: { key: 'openrouterApiKey', validatedAt: 'openrouterValidatedAt' },
  xai: { key: 'xaiApiKey', validatedAt: 'xaiValidatedAt' },
  fish: { key: 'fishApiKey', validatedAt: 'fishValidatedAt' },
  deepseek: { key: 'deepseekApiKey', validatedAt: 'deepseekValidatedAt' },
  kimi: { key: 'kimiApiKey', validatedAt: 'kimiValidatedAt' },
}

export type VoiceCredentialKeyUpdate = Partial<Record<KeyColumn, string | null>>

export async function getUserVoiceCredentialByUserId(
  userId: string,
): Promise<UserVoiceCredentialRow | null> {
  return prismaClient.userVoiceCredential.findUnique({ where: { userId } })
}

/**
 * Writes only the key columns present in `data` (undefined = keep, null = clear).
 * Replacing or clearing a key also clears its validation timestamp.
 */
export async function upsertUserVoiceCredential(
  userId: string,
  data: VoiceCredentialKeyUpdate,
): Promise<void> {
  const changes: Partial<Record<KeyColumn, string | null> & Record<ValidatedAtColumn, null>> = {}
  for (const { key, validatedAt } of Object.values(CREDENTIAL_COLUMNS)) {
    const value = data[key]
    if (typeof value === 'undefined') continue
    changes[key] = value
    changes[validatedAt] = null
  }
  if (Object.keys(changes).length === 0) return

  await prismaClient.userVoiceCredential.upsert({
    where: { userId },
    update: changes,
    create: { userId, ...changes },
  })
}

export async function markVoiceCredentialValidated(
  userId: string,
  provider: VoiceCredentialProvider,
): Promise<void> {
  const { validatedAt } = CREDENTIAL_COLUMNS[provider]
  await prismaClient.userVoiceCredential.updateMany({
    where: { userId },
    data: { [validatedAt]: new Date() },
  })
}
