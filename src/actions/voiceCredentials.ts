'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { prismaClient } from '@/lib/prismaClient'
import { encryptToken } from '@/lib/messages/encrypt'
import {
  CREDENTIAL_COLUMNS,
  getUserVoiceCredentialByUserId,
  markVoiceCredentialValidated,
  upsertUserVoiceCredential,
} from '@/lib/voiceCredentialsRepo'
import {
  checkProviderKey,
  providerKeyStatuses,
  resolveProviderKey,
} from '@/lib/credentials/providerKeys'
import {
  isConfigCredentialProvider,
  type ConfigCredentialProvider,
  type ProviderKeyCheck,
  type ProviderKeyStatus,
} from '@/lib/usage/configProviders'

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string }

type ProviderKeyStatusMap = Record<ConfigCredentialProvider, ProviderKeyStatus>

const MAX_KEY_LENGTH = 512

async function requireUserId(): Promise<string | null> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return null
  const user = await prismaClient.user.findUnique({ where: { clerkId }, select: { id: true } })
  return user?.id ?? null
}

function revalidateKeyViews() {
  revalidatePath('/ai-agents/config')
  revalidatePath('/settings')
}

/** Masked status of every provider key for the signed-in user (keys never leave the server). */
export async function getProviderKeyStatuses(): Promise<ActionResult<{ statuses: ProviderKeyStatusMap }>> {
  const userId = await requireUserId()
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' }
  try {
    const row = await getUserVoiceCredentialByUserId(userId)
    return { ok: true, statuses: providerKeyStatuses(row) }
  } catch (error) {
    console.error('[getProviderKeyStatuses]', error)
    return { ok: false, error: 'Could not load provider keys.' }
  }
}

/**
 * Checks a key live against the provider. With `candidateKey` it tests a pasted key without
 * saving it; without, it re-tests the key currently in use (saved, else .env).
 */
export async function testProviderKey(
  provider: string,
  candidateKey?: string,
): Promise<ActionResult<{ check: ProviderKeyCheck }>> {
  if (!isConfigCredentialProvider(provider)) return { ok: false, error: 'Unknown provider.' }
  const userId = await requireUserId()
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' }

  const candidate = typeof candidateKey === 'string' ? candidateKey.trim() : ''
  if (candidate.length > MAX_KEY_LENGTH) return { ok: false, error: 'That key is too long.' }

  try {
    if (candidate) return { ok: true, check: await checkProviderKey(provider, candidate) }

    const row = await getUserVoiceCredentialByUserId(userId)
    const { key, source } = resolveProviderKey(row, provider)
    if (!key) {
      return { ok: true, check: { valid: false, code: 'MISSING', message: 'No key saved yet.' } }
    }
    const check = await checkProviderKey(provider, key)
    if (check.valid && source === 'database') {
      await markVoiceCredentialValidated(userId, provider)
      revalidateKeyViews()
    }
    return { ok: true, check }
  } catch (error) {
    console.error('[testProviderKey]', provider, error)
    return { ok: false, error: 'Could not check the key.' }
  }
}

/**
 * Validates then saves a key. A key the provider definitively rejects is not saved unless
 * `force` is set (network hiccups never block a save).
 */
export async function saveProviderKey(input: {
  provider: string
  apiKey: string
  force?: boolean
}): Promise<ActionResult<{ saved: boolean; check: ProviderKeyCheck }>> {
  const { provider } = input
  if (!isConfigCredentialProvider(provider)) return { ok: false, error: 'Unknown provider.' }
  const apiKey = typeof input.apiKey === 'string' ? input.apiKey.trim() : ''
  if (!apiKey) return { ok: false, error: 'Paste an API key first.' }
  if (apiKey.length > MAX_KEY_LENGTH || /\s/u.test(apiKey)) {
    return { ok: false, error: 'That does not look like an API key (spaces or too long).' }
  }

  const userId = await requireUserId()
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' }

  try {
    const check = await checkProviderKey(provider, apiKey)
    const rejected = !check.valid && check.code !== 'NETWORK' && check.code !== 'UNKNOWN'
    if (rejected && !input.force) return { ok: true, saved: false, check }

    await upsertUserVoiceCredential(userId, { [CREDENTIAL_COLUMNS[provider].key]: encryptToken(apiKey) })
    if (check.valid) await markVoiceCredentialValidated(userId, provider)
    revalidateKeyViews()
    return { ok: true, saved: true, check }
  } catch (error) {
    console.error('[saveProviderKey]', provider, error)
    return { ok: false, error: 'Failed to save the key. Try again.' }
  }
}

/** Deletes the saved key; the provider falls back to the server .env key if one exists. */
export async function removeProviderKey(provider: string): Promise<ActionResult> {
  if (!isConfigCredentialProvider(provider)) return { ok: false, error: 'Unknown provider.' }
  const userId = await requireUserId()
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' }
  try {
    await upsertUserVoiceCredential(userId, { [CREDENTIAL_COLUMNS[provider].key]: null })
    revalidateKeyViews()
    return { ok: true }
  } catch (error) {
    console.error('[removeProviderKey]', provider, error)
    return { ok: false, error: 'Failed to remove the key.' }
  }
}
