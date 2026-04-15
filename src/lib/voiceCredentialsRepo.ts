import { randomUUID } from 'crypto'
import { prismaClient } from '@/lib/prismaClient'

export type UserVoiceCredentialRow = {
  id: string
  userId: string
  googleApiKey: string | null
  deepgramApiKey: string | null
  openaiApiKey: string | null
  anthropicApiKey: string | null
  googleValidatedAt: Date | null
  deepgramValidatedAt: Date | null
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
      "googleValidatedAt",
      "deepgramValidatedAt",
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

  const d = delegate()
  if (d?.upsert) {
    await d.upsert({
      where: { userId },
      update: {
        googleApiKey: nextGoogle,
        openaiApiKey: nextOpenAi,
        anthropicApiKey: nextAnthropic,
        deepgramApiKey: nextDeepgram,
      },
      create: {
        userId,
        googleApiKey: nextGoogle,
        openaiApiKey: nextOpenAi,
        anthropicApiKey: nextAnthropic,
        deepgramApiKey: nextDeepgram,
      },
    })
    return
  }

  const id = current?.id ?? randomUUID()
  await prismaClient.$executeRaw`
    INSERT INTO "UserVoiceCredential" ("id", "userId", "googleApiKey", "openaiApiKey", "anthropicApiKey", "deepgramApiKey", "createdAt", "updatedAt")
    VALUES (${id}::uuid, ${userId}::uuid, ${nextGoogle}, ${nextOpenAi}, ${nextAnthropic}, ${nextDeepgram}, NOW(), NOW())
    ON CONFLICT ("userId")
    DO UPDATE SET
      "googleApiKey" = EXCLUDED."googleApiKey",
      "openaiApiKey" = EXCLUDED."openaiApiKey",
      "anthropicApiKey" = EXCLUDED."anthropicApiKey",
      "deepgramApiKey" = EXCLUDED."deepgramApiKey",
      "updatedAt" = NOW()
  `
}

export async function markVoiceCredentialValidated(
  userId: string,
  provider: 'google' | 'deepgram',
): Promise<void> {
  const d = delegate()
  const field = provider === 'google' ? 'googleValidatedAt' : 'deepgramValidatedAt'

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

  await prismaClient.$executeRaw`
    UPDATE "UserVoiceCredential"
    SET "deepgramValidatedAt" = NOW(), "updatedAt" = NOW()
    WHERE "userId" = ${userId}::uuid
  `
}

