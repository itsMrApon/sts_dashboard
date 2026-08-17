'use server'

import { auth } from '@clerk/nextjs/server'
import { prismaClient } from '@/lib/prismaClient'
import { decryptToken, encryptToken } from '@/lib/messages/encrypt'
import {
  getUserVoiceCredentialByUserId,
  markVoiceCredentialValidated,
  upsertUserVoiceCredential,
} from '@/lib/voiceCredentialsRepo'

type CredentialProvider =
  | 'google'
  | 'openai'
  | 'anthropic'
  | 'deepgram'
  | 'fish'
  | 'deepseek'
  | 'kimi'

type CredentialValidationCode =
  | 'VALID'
  | 'MISSING'
  | 'INVALID'
  | 'QUOTA_EXCEEDED'
  | 'PERMISSION_DENIED'
  | 'NETWORK'
  | 'UNKNOWN'

type SaveVoiceCredentialsInput = {
  googleApiKey?: string
  openaiApiKey?: string
  anthropicApiKey?: string
  deepgramApiKey?: string
  fishApiKey?: string
  deepseekApiKey?: string
  kimiApiKey?: string
}

type KeySource = 'database' | 'env' | 'none'

type GetVoiceCredentialsResult = {
  hasGoogleApiKey: boolean
  hasOpenAiApiKey: boolean
  hasAnthropicApiKey: boolean
  hasDeepgramApiKey: boolean
  hasFishApiKey: boolean
  hasDeepseekApiKey: boolean
  hasKimiApiKey: boolean
  maskedGoogleApiKey: string | null
  maskedOpenAiApiKey: string | null
  maskedAnthropicApiKey: string | null
  maskedDeepgramApiKey: string | null
  maskedFishApiKey: string | null
  maskedDeepseekApiKey: string | null
  maskedKimiApiKey: string | null
  googleKeySource: KeySource
  openaiKeySource: KeySource
  anthropicKeySource: KeySource
  deepgramKeySource: KeySource
  fishKeySource: KeySource
  deepseekKeySource: KeySource
  kimiKeySource: KeySource
  googleValidatedAt: string | null
  openaiValidatedAt: string | null
  anthropicValidatedAt: string | null
  deepgramValidatedAt: string | null
  fishValidatedAt: string | null
  deepseekValidatedAt: string | null
  kimiValidatedAt: string | null
}

function emptyCredentials(): GetVoiceCredentialsResult {
  return {
    hasGoogleApiKey: false,
    hasOpenAiApiKey: false,
    hasAnthropicApiKey: false,
    hasDeepgramApiKey: false,
    hasFishApiKey: false,
    hasDeepseekApiKey: false,
    hasKimiApiKey: false,
    maskedGoogleApiKey: null,
    maskedOpenAiApiKey: null,
    maskedAnthropicApiKey: null,
    maskedDeepgramApiKey: null,
    maskedFishApiKey: null,
    maskedDeepseekApiKey: null,
    maskedKimiApiKey: null,
    googleKeySource: 'none',
    openaiKeySource: 'none',
    anthropicKeySource: 'none',
    deepgramKeySource: 'none',
    fishKeySource: 'none',
    deepseekKeySource: 'none',
    kimiKeySource: 'none',
    googleValidatedAt: null,
    openaiValidatedAt: null,
    anthropicValidatedAt: null,
    deepgramValidatedAt: null,
    fishValidatedAt: null,
    deepseekValidatedAt: null,
    kimiValidatedAt: null,
  }
}

function maskKey(raw: string | null): string | null {
  if (!raw) return null
  if (raw.length <= 8) return '********'
  return `${raw.slice(0, 4)}...${raw.slice(-4)}`
}

function safeDecrypt(value: string | null | undefined): string | null {
  try {
    return decryptToken(value)
  } catch {
    return null
  }
}

function getEnvGoogleKey(): string | null {
  return process.env.GOOGLE_API_KEY?.trim() || null
}

function getEnvDeepgramKey(): string | null {
  return process.env.DEEPGRAM_API_KEY?.trim() || null
}

function getEnvOpenAiKey(): string | null {
  return process.env.OPENAI_API_KEY?.trim() || null
}

function getEnvAnthropicKey(): string | null {
  return process.env.ANTHROPIC_API_KEY?.trim() || null
}

function getEnvFishKey(): string | null {
  return process.env.FISH_API_KEY?.trim() || null
}

function getEnvDeepseekKey(): string | null {
  return process.env.DEEPSEEK_API_KEY?.trim() || null
}

function getEnvKimiKey(): string | null {
  return process.env.MOONSHOT_API_KEY?.trim() || process.env.KIMI_API_KEY?.trim() || null
}

async function requireUserId(): Promise<string> {
  const { userId: clerkId } = await auth()
  if (!clerkId) throw new Error('UNAUTHENTICATED')
  const user = await prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!user) throw new Error('User not found')
  return user.id
}

function sourceOf(db: string | null, env: string | null): KeySource {
  if (db) return 'database'
  if (env) return 'env'
  return 'none'
}

export async function getVoiceCredentials(): Promise<{
  success: boolean
  data?: GetVoiceCredentialsResult
  error?: string
}> {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return { success: true, data: emptyCredentials() }
    }
    const user = await prismaClient.user.findUnique({
      where: { clerkId },
      select: { id: true },
    })
    if (!user) {
      return { success: true, data: emptyCredentials() }
    }
    const userId = user.id
    const row = await getUserVoiceCredentialByUserId(userId)

    const dbGoogle = safeDecrypt(row?.googleApiKey)
    const dbOpenAi = safeDecrypt(row?.openaiApiKey)
    const dbAnthropic = safeDecrypt(row?.anthropicApiKey)
    const dbDeepgram = safeDecrypt(row?.deepgramApiKey)
    const dbFish = safeDecrypt(row?.fishApiKey)
    const dbDeepseek = safeDecrypt(row?.deepseekApiKey)
    const dbKimi = safeDecrypt(row?.kimiApiKey)

    const envGoogle = getEnvGoogleKey()
    const envOpenAi = getEnvOpenAiKey()
    const envAnthropic = getEnvAnthropicKey()
    const envDeepgram = getEnvDeepgramKey()
    const envFish = getEnvFishKey()
    const envDeepseek = getEnvDeepseekKey()
    const envKimi = getEnvKimiKey()

    const googlePlain = dbGoogle || envGoogle
    const openAiPlain = dbOpenAi || envOpenAi
    const anthropicPlain = dbAnthropic || envAnthropic
    const deepgramPlain = dbDeepgram || envDeepgram
    const fishPlain = dbFish || envFish
    const deepseekPlain = dbDeepseek || envDeepseek
    const kimiPlain = dbKimi || envKimi

    return {
      success: true,
      data: {
        hasGoogleApiKey: !!googlePlain,
        hasOpenAiApiKey: !!openAiPlain,
        hasAnthropicApiKey: !!anthropicPlain,
        hasDeepgramApiKey: !!deepgramPlain,
        hasFishApiKey: !!fishPlain,
        hasDeepseekApiKey: !!deepseekPlain,
        hasKimiApiKey: !!kimiPlain,
        maskedGoogleApiKey: maskKey(googlePlain),
        maskedOpenAiApiKey: maskKey(openAiPlain),
        maskedAnthropicApiKey: maskKey(anthropicPlain),
        maskedDeepgramApiKey: maskKey(deepgramPlain),
        maskedFishApiKey: maskKey(fishPlain),
        maskedDeepseekApiKey: maskKey(deepseekPlain),
        maskedKimiApiKey: maskKey(kimiPlain),
        googleKeySource: sourceOf(dbGoogle, envGoogle),
        openaiKeySource: sourceOf(dbOpenAi, envOpenAi),
        anthropicKeySource: sourceOf(dbAnthropic, envAnthropic),
        deepgramKeySource: sourceOf(dbDeepgram, envDeepgram),
        fishKeySource: sourceOf(dbFish, envFish),
        deepseekKeySource: sourceOf(dbDeepseek, envDeepseek),
        kimiKeySource: sourceOf(dbKimi, envKimi),
        googleValidatedAt: row?.googleValidatedAt?.toISOString() ?? null,
        openaiValidatedAt: null,
        anthropicValidatedAt: null,
        deepgramValidatedAt: row?.deepgramValidatedAt?.toISOString() ?? null,
        fishValidatedAt: row?.fishValidatedAt?.toISOString() ?? null,
        deepseekValidatedAt: row?.deepseekValidatedAt?.toISOString() ?? null,
        kimiValidatedAt: row?.kimiValidatedAt?.toISOString() ?? null,
      },
    }
  } catch {
    return { success: false, error: 'Failed to load voice credentials' }
  }
}

export async function saveVoiceCredentials(input: SaveVoiceCredentialsInput): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const userId = await requireUserId()
    const data: {
      googleApiKey?: string | null
      openaiApiKey?: string | null
      anthropicApiKey?: string | null
      deepgramApiKey?: string | null
      fishApiKey?: string | null
      deepseekApiKey?: string | null
      kimiApiKey?: string | null
    } = {}

    const assignEncrypted = (
      key: keyof typeof data,
      value: string | undefined,
    ) => {
      if (typeof value !== 'string') return
      const trimmed = value.trim()
      data[key] = trimmed ? encryptToken(trimmed) : null
    }

    assignEncrypted('googleApiKey', input.googleApiKey)
    assignEncrypted('deepgramApiKey', input.deepgramApiKey)
    assignEncrypted('openaiApiKey', input.openaiApiKey)
    assignEncrypted('anthropicApiKey', input.anthropicApiKey)
    assignEncrypted('fishApiKey', input.fishApiKey)
    assignEncrypted('deepseekApiKey', input.deepseekApiKey)
    assignEncrypted('kimiApiKey', input.kimiApiKey)

    await upsertUserVoiceCredential(userId, data)

    return { success: true }
  } catch {
    return { success: false, error: 'Failed to save voice credentials' }
  }
}

async function validateBearerModels(
  url: string,
  apiKey: string,
  label: string,
): Promise<{ valid: boolean; code: CredentialValidationCode; error?: string }> {
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      return { valid: false, code: 'INVALID', error: `${label} API key is invalid or unauthorized.` }
    }
    if (res.status === 429) {
      return { valid: false, code: 'QUOTA_EXCEEDED', error: `${label} quota/rate limit exceeded.` }
    }
    return { valid: false, code: 'UNKNOWN', error: `${label} validation failed (HTTP ${res.status}).` }
  }
  return { valid: true, code: 'VALID' }
}

export async function validateVoiceCredential(provider: CredentialProvider): Promise<{
  success: boolean
  valid?: boolean
  error?: string
  code?: CredentialValidationCode
}> {
  try {
    const userId = await requireUserId()
    const row = await getUserVoiceCredentialByUserId(userId)

    if (provider === 'google') {
      const googleApiKey = safeDecrypt(row?.googleApiKey) || getEnvGoogleKey()
      if (!googleApiKey) {
        return {
          success: false,
          error: 'Gemini API key is missing. Save it in Config Agent or set GOOGLE_API_KEY in .env.',
          code: 'MISSING',
        }
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(googleApiKey)}`,
        { method: 'GET', cache: 'no-store' },
      )

      if (!res.ok) {
        let reason = ''
        try {
          const payload = (await res.json()) as { error?: { status?: string; message?: string } }
          reason = payload?.error?.status || payload?.error?.message || ''
        } catch {
          reason = ''
        }
        if (res.status === 429 || reason.includes('QUOTA')) {
          return {
            success: true,
            valid: false,
            code: 'QUOTA_EXCEEDED',
            error: 'Gemini quota exceeded. Wait for reset or upgrade billing.',
          }
        }
        if (res.status === 403) {
          return {
            success: true,
            valid: false,
            code: 'PERMISSION_DENIED',
            error: 'Gemini access denied for this project/key.',
          }
        }
        if (res.status === 400 || reason.includes('API_KEY_INVALID')) {
          return {
            success: true,
            valid: false,
            code: 'INVALID',
            error: 'Gemini API key is invalid or revoked.',
          }
        }
        return {
          success: true,
          valid: false,
          code: 'UNKNOWN',
          error: `Gemini validation failed (HTTP ${res.status}).`,
        }
      }

      if (row) {
        await markVoiceCredentialValidated(userId, 'google')
      }
      return { success: true, valid: true, code: 'VALID' }
    }

    if (provider === 'openai') {
      const openaiApiKey = safeDecrypt(row?.openaiApiKey) || getEnvOpenAiKey()
      if (!openaiApiKey) {
        return {
          success: false,
          error: 'OpenAI API key is missing. Save it in Config Agent or set OPENAI_API_KEY in .env.',
          code: 'MISSING',
        }
      }
      const result = await validateBearerModels(
        'https://api.openai.com/v1/models',
        openaiApiKey,
        'OpenAI',
      )
      return { success: true, ...result }
    }

    if (provider === 'anthropic') {
      const anthropicApiKey = safeDecrypt(row?.anthropicApiKey) || getEnvAnthropicKey()
      if (!anthropicApiKey) {
        return {
          success: false,
          error: 'Claude API key is missing. Save it in Config Agent or set ANTHROPIC_API_KEY in .env.',
          code: 'MISSING',
        }
      }

      const anthropicRes = await fetch('https://api.anthropic.com/v1/models', {
        method: 'GET',
        headers: {
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01',
        },
        cache: 'no-store',
      })

      if (!anthropicRes.ok) {
        if (anthropicRes.status === 401 || anthropicRes.status === 403) {
          return {
            success: true,
            valid: false,
            code: 'INVALID',
            error: 'Claude API key is invalid or unauthorized.',
          }
        }
        if (anthropicRes.status === 429) {
          return {
            success: true,
            valid: false,
            code: 'QUOTA_EXCEEDED',
            error: 'Claude quota/rate limit exceeded.',
          }
        }
        return {
          success: true,
          valid: false,
          code: 'UNKNOWN',
          error: `Claude validation failed (HTTP ${anthropicRes.status}).`,
        }
      }

      return { success: true, valid: true, code: 'VALID' }
    }

    if (provider === 'fish') {
      const fishApiKey = safeDecrypt(row?.fishApiKey) || getEnvFishKey()
      if (!fishApiKey) {
        return {
          success: false,
          error: 'Fish Audio API key is missing. Save it in Config Agent or set FISH_API_KEY in .env.',
          code: 'MISSING',
        }
      }
      const result = await validateBearerModels(
        'https://api.fish.audio/model',
        fishApiKey,
        'Fish Audio',
      )
      if (result.valid && row) {
        await markVoiceCredentialValidated(userId, 'fish')
      }
      return { success: true, ...result }
    }

    if (provider === 'deepseek') {
      const deepseekApiKey = safeDecrypt(row?.deepseekApiKey) || getEnvDeepseekKey()
      if (!deepseekApiKey) {
        return {
          success: false,
          error:
            'DeepSeek API key is missing. Save it in Config Agent or set DEEPSEEK_API_KEY in .env.',
          code: 'MISSING',
        }
      }
      const result = await validateBearerModels(
        'https://api.deepseek.com/v1/models',
        deepseekApiKey,
        'DeepSeek',
      )
      if (result.valid && row) {
        await markVoiceCredentialValidated(userId, 'deepseek')
      }
      return { success: true, ...result }
    }

    if (provider === 'kimi') {
      const kimiApiKey = safeDecrypt(row?.kimiApiKey) || getEnvKimiKey()
      if (!kimiApiKey) {
        return {
          success: false,
          error:
            'Kimi API key is missing. Save it in Config Agent or set MOONSHOT_API_KEY in .env.',
          code: 'MISSING',
        }
      }
      const result = await validateBearerModels(
        'https://api.moonshot.ai/v1/models',
        kimiApiKey,
        'Kimi',
      )
      if (result.valid && row) {
        await markVoiceCredentialValidated(userId, 'kimi')
      }
      return { success: true, ...result }
    }

    const deepgramApiKey = safeDecrypt(row?.deepgramApiKey) || getEnvDeepgramKey()
    if (!deepgramApiKey) {
      return {
        success: false,
        error: 'Deepgram API key is missing. Save it in Config Agent or set DEEPGRAM_API_KEY in .env.',
        code: 'MISSING',
      }
    }

    const deepgramRes = await fetch('https://api.deepgram.com/v1/projects', {
      method: 'GET',
      headers: { Authorization: `Token ${deepgramApiKey}` },
      cache: 'no-store',
    })

    if (!deepgramRes.ok) {
      if (deepgramRes.status === 401 || deepgramRes.status === 403) {
        return {
          success: true,
          valid: false,
          code: 'INVALID',
          error: 'Deepgram API key is invalid or unauthorized.',
        }
      }
      if (deepgramRes.status === 429) {
        return {
          success: true,
          valid: false,
          code: 'QUOTA_EXCEEDED',
          error: 'Deepgram quota exceeded. Check account limits.',
        }
      }
      return {
        success: true,
        valid: false,
        code: 'UNKNOWN',
        error: `Deepgram validation failed (HTTP ${deepgramRes.status}).`,
      }
    }

    if (row) {
      await markVoiceCredentialValidated(userId, 'deepgram')
    }
    return { success: true, valid: true, code: 'VALID' }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to validate credential',
      code: 'NETWORK',
    }
  }
}
