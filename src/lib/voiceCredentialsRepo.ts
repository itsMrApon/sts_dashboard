import { randomUUID } from 'crypto'
import { prismaClient } from '@/lib/prismaClient'

export type VoiceCredentialProvider =
  | 'google'
  | 'deepgram'
  | 'openai'
  | 'anthropic'
  | 'fish'
  | 'deepseek'
  | 'kimi'

export type UserVoiceCredentialRow = {
  id: string
  userId: string
  googleApiKey: string | null
  deepgramApiKey: string | null
  openaiApiKey: string | null
  anthropicApiKey: string | null
  fishApiKey: string | null
  deepseekApiKey: string | null
  kimiApiKey: string | null
  googleValidatedAt: Date | null
  deepgramValidatedAt: Date | null
  fishValidatedAt: Date | null
  deepseekValidatedAt: Date | null
  kimiValidatedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

function delegate() {
  return (prismaClient as any).userVoiceCredential
}

export async function getUserVoiceCredentialByUserId(
  userId: string,
): Promise<UserVoiceCredentialRow | null> {
  const d = delegate()
  if (d?.findUnique) {
    return d.findUnique({ where: { userId } })
  }

  const rows = await prismaClient.$queryRaw<UserVoiceCredentialRow[]>`
    SELECT
      "id",
      "userId",
      "googleApiKey",
      "deepgramApiKey",
      "openaiApiKey",
      "anthropicApiKey",
      "fishApiKey",
      "deepseekApiKey",
      "kimiApiKey",
      "googleValidatedAt",
      "deepgramValidatedAt",
      "fishValidatedAt",
      "deepseekValidatedAt",
      "kimiValidatedAt",
      "createdAt",
      "updatedAt"
    FROM "UserVoiceCredential"
    WHERE "userId" = ${userId}
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function upsertUserVoiceCredential(
  userId: string,
  data: {
    googleApiKey?: string | null
    openaiApiKey?: string | null
    anthropicApiKey?: string | null
    deepgramApiKey?: string | null
    fishApiKey?: string | null
    deepseekApiKey?: string | null
    kimiApiKey?: string | null
  },
): Promise<void> {
  const current = await getUserVoiceCredentialByUserId(userId)
  const nextGoogle =
    typeof data.googleApiKey === 'undefined' ? current?.googleApiKey ?? null : data.googleApiKey
  const nextOpenAi =
    typeof data.openaiApiKey === 'undefined' ? current?.openaiApiKey ?? null : data.openaiApiKey
  const nextAnthropic =
    typeof data.anthropicApiKey === 'undefined'
      ? current?.anthropicApiKey ?? null
      : data.anthropicApiKey
  const nextDeepgram =
    typeof data.deepgramApiKey === 'undefined'
      ? current?.deepgramApiKey ?? null
      : data.deepgramApiKey
  const nextFish =
    typeof data.fishApiKey === 'undefined' ? current?.fishApiKey ?? null : data.fishApiKey
  const nextDeepseek =
    typeof data.deepseekApiKey === 'undefined'
      ? current?.deepseekApiKey ?? null
      : data.deepseekApiKey
  const nextKimi =
    typeof data.kimiApiKey === 'undefined' ? current?.kimiApiKey ?? null : data.kimiApiKey

  const d = delegate()
  if (d?.upsert) {
    await d.upsert({
      where: { userId },
      update: {
        googleApiKey: nextGoogle,
        openaiApiKey: nextOpenAi,
        anthropicApiKey: nextAnthropic,
        deepgramApiKey: nextDeepgram,
        fishApiKey: nextFish,
        deepseekApiKey: nextDeepseek,
        kimiApiKey: nextKimi,
      },
      create: {
        userId,
        googleApiKey: nextGoogle,
        openaiApiKey: nextOpenAi,
        anthropicApiKey: nextAnthropic,
        deepgramApiKey: nextDeepgram,
        fishApiKey: nextFish,
        deepseekApiKey: nextDeepseek,
        kimiApiKey: nextKimi,
      },
    })
    return
  }

  const id = current?.id ?? randomUUID()
  await prismaClient.$executeRaw`
    INSERT INTO "UserVoiceCredential" (
      "id", "userId", "googleApiKey", "openaiApiKey", "anthropicApiKey", "deepgramApiKey",
      "fishApiKey", "deepseekApiKey", "kimiApiKey", "createdAt", "updatedAt"
    )
    VALUES (
      ${id}::uuid, ${userId}::uuid, ${nextGoogle}, ${nextOpenAi}, ${nextAnthropic}, ${nextDeepgram},
      ${nextFish}, ${nextDeepseek}, ${nextKimi}, NOW(), NOW()
    )
    ON CONFLICT ("userId")
    DO UPDATE SET
      "googleApiKey" = EXCLUDED."googleApiKey",
      "openaiApiKey" = EXCLUDED."openaiApiKey",
      "anthropicApiKey" = EXCLUDED."anthropicApiKey",
      "deepgramApiKey" = EXCLUDED."deepgramApiKey",
      "fishApiKey" = EXCLUDED."fishApiKey",
      "deepseekApiKey" = EXCLUDED."deepseekApiKey",
      "kimiApiKey" = EXCLUDED."kimiApiKey",
      "updatedAt" = NOW()
  `
}

const VALIDATED_AT_FIELD: Record<
  'google' | 'deepgram' | 'fish' | 'deepseek' | 'kimi',
  keyof UserVoiceCredentialRow
> = {
  google: 'googleValidatedAt',
  deepgram: 'deepgramValidatedAt',
  fish: 'fishValidatedAt',
  deepseek: 'deepseekValidatedAt',
  kimi: 'kimiValidatedAt',
}

export async function markVoiceCredentialValidated(
  userId: string,
  provider: 'google' | 'deepgram' | 'fish' | 'deepseek' | 'kimi',
): Promise<void> {
  const d = delegate()
  const field = VALIDATED_AT_FIELD[provider]

  if (d?.update) {
    await d.update({
      where: { userId },
      data: { [field]: new Date() },
    })
    return
  }

  if (provider === 'google') {
    await prismaClient.$executeRaw`
      UPDATE "UserVoiceCredential"
      SET "googleValidatedAt" = NOW(), "updatedAt" = NOW()
      WHERE "userId" = ${userId}::uuid
    `
    return
  }
  if (provider === 'deepgram') {
    await prismaClient.$executeRaw`
      UPDATE "UserVoiceCredential"
      SET "deepgramValidatedAt" = NOW(), "updatedAt" = NOW()
      WHERE "userId" = ${userId}::uuid
    `
    return
  }
  if (provider === 'fish') {
    await prismaClient.$executeRaw`
      UPDATE "UserVoiceCredential"
      SET "fishValidatedAt" = NOW(), "updatedAt" = NOW()
      WHERE "userId" = ${userId}::uuid
    `
    return
  }
  if (provider === 'deepseek') {
    await prismaClient.$executeRaw`
      UPDATE "UserVoiceCredential"
      SET "deepseekValidatedAt" = NOW(), "updatedAt" = NOW()
      WHERE "userId" = ${userId}::uuid
    `
    return
  }

  await prismaClient.$executeRaw`
    UPDATE "UserVoiceCredential"
    SET "kimiValidatedAt" = NOW(), "updatedAt" = NOW()
    WHERE "userId" = ${userId}::uuid
  `
}
