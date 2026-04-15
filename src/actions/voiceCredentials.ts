'use server'

import { auth } from '@clerk/nextjs/server'
import { prismaClient } from '@/lib/prismaClient'
import { decryptToken, encryptToken } from '@/lib/messages/encrypt'
import {
  getUserVoiceCredentialByUserId,
  markVoiceCredentialValidated,
  upsertUserVoiceCredential,
} from '@/lib/voiceCredentialsRepo'

type CredentialProvider = 'google' | 'openai' | 'anthropic' | 'deepgram'
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
}

type GetVoiceCredentialsResult = {
  hasGoogleApiKey: boolean
  hasOpenAiApiKey: boolean
  hasAnthropicApiKey: boolean
  hasDeepgramApiKey: boolean
  maskedGoogleApiKey: string | null
  maskedOpenAiApiKey: string | null
  maskedAnthropicApiKey: string | null
  maskedDeepgramApiKey: string | null
  googleKeySource: 'database' | 'env' | 'none'
  openaiKeySource: 'database' | 'env' | 'none'
  anthropicKeySource: 'database' | 'env' | 'none'
  deepgramKeySource: 'database' | 'env' | 'none'
  googleValidatedAt: string | null
  openaiValidatedAt: string | null
  anthropicValidatedAt: string | null
  deepgramValidatedAt: string | null
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

export async function getVoiceCredentials(): Promise<{
  success: boolean
  data?: GetVoiceCredentialsResult
  error?: string
}> {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return {
        success: true,
        data: {
          hasGoogleApiKey: false,
          hasOpenAiApiKey: false,
          hasAnthropicApiKey: false,
          hasDeepgramApiKey: false,
          maskedGoogleApiKey: null,
          maskedOpenAiApiKey: null,
          maskedAnthropicApiKey: null,
          maskedDeepgramApiKey: null,
          googleKeySource: 'none',
          openaiKeySource: 'none',
          anthropicKeySource: 'none',
          deepgramKeySource: 'none',
          googleValidatedAt: null,
          openaiValidatedAt: null,
          anthropicValidatedAt: null,
          deepgramValidatedAt: null,
        },
      }
    }
    const user = await prismaClient.user.findUnique({
      where: { clerkId },
      select: { id: true },
    })
    if (!user) {
      return {
        success: true,
        data: {
          hasGoogleApiKey: false,
          hasOpenAiApiKey: false,
          hasAnthropicApiKey: false,
          hasDeepgramApiKey: false,
          maskedGoogleApiKey: null,
          maskedOpenAiApiKey: null,
          maskedAnthropicApiKey: null,
          maskedDeepgramApiKey: null,
          googleKeySource: 'none',
          openaiKeySource: 'none',
          anthropicKeySource: 'none',
          deepgramKeySource: 'none',
          googleValidatedAt: null,
          openaiValidatedAt: null,
          anthropicValidatedAt: null,
          deepgramValidatedAt: null,
        },
      }
    }
    const userId = user.id
    const row = await getUserVoiceCredentialByUserId(userId)

    const dbGoogle = safeDecrypt(row?.googleApiKey)
    const dbOpenAi = safeDecrypt(row?.openaiApiKey)
    const dbAnthropic = safeDecrypt(row?.anthropicApiKey)
    const dbDeepgram = safeDecrypt(row?.deepgramApiKey)
    const envGoogle = getEnvGoogleKey()
    const envOpenAi = getEnvOpenAiKey()
    const envAnthropic = getEnvAnthropicKey()
    const envDeepgram = getEnvDeepgramKey()
    const googlePlain = dbGoogle || envGoogle
    const openAiPlain = dbOpenAi || envOpenAi
    const anthropicPlain = dbAnthropic || envAnthropic
    const deepgramPlain = dbDeepgram || envDeepgram

    return {
      success: true,
      data: {
        hasGoogleApiKey: !!googlePlain,
        hasOpenAiApiKey: !!openAiPlain,
        hasAnthropicApiKey: !!anthropicPlain,
        hasDeepgramApiKey: !!deepgramPlain,
        maskedGoogleApiKey: maskKey(googlePlain),
        maskedOpenAiApiKey: maskKey(openAiPlain),
        maskedAnthropicApiKey: maskKey(anthropicPlain),
        maskedDeepgramApiKey: maskKey(deepgramPlain),
        googleKeySource: dbGoogle ? 'database' : envGoogle ? 'env' : 'none',
        openaiKeySource: dbOpenAi ? 'database' : envOpenAi ? 'env' : 'none',
        anthropicKeySource: dbAnthropic ? 'database' : envAnthropic ? 'env' : 'none',
        deepgramKeySource: dbDeepgram ? 'database' : envDeepgram ? 'env' : 'none',
        googleValidatedAt: row?.googleValidatedAt?.toISOString() ?? null,
        openaiValidatedAt: null,
        anthropicValidatedAt: null,
        deepgramValidatedAt: row?.deepgramValidatedAt?.toISOString() ?? null,
      },
    }
  } catch (error) {
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
      googleApiKey?: string
      openaiApiKey?: string
      anthropicApiKey?: string
      deepgramApiKey?: string
    } = {}

    if (typeof input.googleApiKey === 'string') {
      const trimmed = input.googleApiKey.trim()
      data.googleApiKey = trimmed ? encryptToken(trimmed) : null
    }

    if (typeof input.deepgramApiKey === 'string') {
      const trimmed = input.deepgramApiKey.trim()
      data.deepgramApiKey = trimmed ? encryptToken(trimmed) : null
    }

    if (typeof input.openaiApiKey === 'string') {
      const trimmed = input.openaiApiKey.trim()
      data.openaiApiKey = trimmed ? encryptToken(trimmed) : null
    }

    if (typeof input.anthropicApiKey === 'string') {
      const trimmed = input.anthropicApiKey.trim()
      data.anthropicApiKey = trimmed ? encryptToken(trimmed) : null
    }

    await upsertUserVoiceCredential(userId, {
      googleApiKey: data.googleApiKey,
      openaiApiKey: data.openaiApiKey,
      anthropicApiKey: data.anthropicApiKey,
      deepgramApiKey: data.deepgramApiKey,
    })

    return { success: true }
  } catch {
    return { success: false, error: 'Failed to save voice credentials' }
  }
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
      const googleApiKey =
        safeDecrypt(row?.googleApiKey) || getEnvGoogleKey()
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
      const openaiApiKey =
        safeDecrypt(row?.openaiApiKey) || getEnvOpenAiKey()
      if (!openaiApiKey) {
        return {
          success: false,
          error: 'OpenAI API key is missing. Save it in Config Agent or set OPENAI_API_KEY in .env.',
          code: 'MISSING',
        }
      }

      const openaiRes = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: { Authorization: `Bearer ${openaiApiKey}` },
        cache: 'no-store',
      })

      if (!openaiRes.ok) {
        if (openaiRes.status === 401 || openaiRes.status === 403) {
          return { success: true, valid: false, code: 'INVALID', error: 'OpenAI API key is invalid or unauthorized.' }
        }
        if (openaiRes.status === 429) {
          return { success: true, valid: false, code: 'QUOTA_EXCEEDED', error: 'OpenAI quota/rate limit exceeded.' }
        }
        return { success: true, valid: false, code: 'UNKNOWN', error: `OpenAI validation failed (HTTP ${openaiRes.status}).` }
      }

      return { success: true, valid: true, code: 'VALID' }
    }

    if (provider === 'anthropic') {
      const anthropicApiKey =
        safeDecrypt(row?.anthropicApiKey) || getEnvAnthropicKey()
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
          return { success: true, valid: false, code: 'INVALID', error: 'Claude API key is invalid or unauthorized.' }
        }
        if (anthropicRes.status === 429) {
          return { success: true, valid: false, code: 'QUOTA_EXCEEDED', error: 'Claude quota/rate limit exceeded.' }
        }
        return { success: true, valid: false, code: 'UNKNOWN', error: `Claude validation failed (HTTP ${anthropicRes.status}).` }
      }

      return { success: true, valid: true, code: 'VALID' }
    }

    const deepgramApiKey =
      safeDecrypt(row?.deepgramApiKey) || getEnvDeepgramKey()
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

