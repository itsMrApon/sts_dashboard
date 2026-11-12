import 'server-only'
import { decryptToken } from '@/lib/messages/encrypt'
import {
  CREDENTIAL_COLUMNS,
  type UserVoiceCredentialRow,
  type VoiceCredentialProvider,
} from '@/lib/voiceCredentialsRepo'
import type {
  ProviderKeyCheck,
  ProviderKeySource,
  ProviderKeyStatus,
} from '@/lib/usage/configProviders'

const VALIDATION_TIMEOUT_MS = 8_000

/** Env fallbacks, first match wins. Mirrors what the voice worker receives in tenant_env. */
const ENV_FALLBACKS: Record<VoiceCredentialProvider, string[]> = {
  google: ['GOOGLE_API_KEY'],
  openai: ['OPENAI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
  openrouter: ['OPENROUTER_API_KEY'],
  xai: ['XAI_API_KEY'],
  deepseek: ['DEEPSEEK_API_KEY'],
  kimi: ['MOONSHOT_API_KEY', 'KIMI_API_KEY'],
  deepgram: ['DEEPGRAM_API_KEY'],
  fish: ['FISH_API_KEY'],
}

const PROVIDER_LABEL: Record<VoiceCredentialProvider, string> = {
  google: 'Gemini',
  openai: 'OpenAI',
  anthropic: 'Claude',
  openrouter: 'OpenRouter',
  xai: 'xAI Grok',
  deepseek: 'DeepSeek',
  kimi: 'Kimi',
  deepgram: 'Deepgram',
  fish: 'Fish Audio',
}

export const ALL_KEY_PROVIDERS = Object.keys(CREDENTIAL_COLUMNS) as VoiceCredentialProvider[]

function safeDecrypt(value: string | null | undefined): string | null {
  try {
    return decryptToken(value)
  } catch {
    return null
  }
}

export function envKeyFor(provider: VoiceCredentialProvider): string | null {
  for (const name of ENV_FALLBACKS[provider]) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return null
}

export function savedKeyFor(
  row: UserVoiceCredentialRow | null,
  provider: VoiceCredentialProvider,
): string | null {
  if (!row) return null
  return safeDecrypt(row[CREDENTIAL_COLUMNS[provider].key])
}

/** Saved key first, then the server env fallback. */
export function resolveProviderKey(
  row: UserVoiceCredentialRow | null,
  provider: VoiceCredentialProvider,
): { key: string | null; source: ProviderKeySource } {
  const saved = savedKeyFor(row, provider)
  if (saved) return { key: saved, source: 'database' }
  const env = envKeyFor(provider)
  if (env) return { key: env, source: 'env' }
  return { key: null, source: 'none' }
}

export function maskKey(raw: string | null): string | null {
  if (!raw) return null
  if (raw.length <= 8) return '••••••••'
  return `${raw.slice(0, 4)}…${raw.slice(-4)}`
}

export function providerKeyStatuses(
  row: UserVoiceCredentialRow | null,
): Record<VoiceCredentialProvider, ProviderKeyStatus> {
  const entries = ALL_KEY_PROVIDERS.map((provider) => {
    const { key, source } = resolveProviderKey(row, provider)
    // A timestamp only describes the saved key; env keys are never validated-and-stored.
    const validatedAt =
      source === 'database' ? row?.[CREDENTIAL_COLUMNS[provider].validatedAt]?.toISOString() ?? null : null
    const status: ProviderKeyStatus = { hasKey: Boolean(key), masked: maskKey(key), source, validatedAt }
    return [provider, status] as const
  })
  return Object.fromEntries(entries) as Record<VoiceCredentialProvider, ProviderKeyStatus>
}

function fail(code: ProviderKeyCheck['code'], message: string): ProviderKeyCheck {
  return { valid: false, code, message }
}

function failFromStatus(label: string, status: number): ProviderKeyCheck {
  if (status === 401) return fail('INVALID', `${label} rejected this key (invalid or revoked).`)
  if (status === 403) return fail('PERMISSION_DENIED', `${label} key lacks permission for this API.`)
  if (status === 402) return fail('QUOTA_EXCEEDED', `${label} account has no credit left.`)
  if (status === 429) return fail('QUOTA_EXCEEDED', `${label} rate limit or quota exceeded.`)
  return fail('UNKNOWN', `${label} validation failed (HTTP ${status}).`)
}

async function getJson(url: string, headers: Record<string, string>) {
  const res = await fetch(url, {
    method: 'GET',
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(VALIDATION_TIMEOUT_MS),
  })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { res, body }
}

function countModels(body: unknown): number | null {
  if (!body || typeof body !== 'object') return null
  const record = body as { data?: unknown; models?: unknown }
  const list = Array.isArray(record.data) ? record.data : Array.isArray(record.models) ? record.models : null
  return list ? list.length : null
}

function modelDetails(body: unknown): string[] | undefined {
  const count = countModels(body)
  return count ? [`${count} models available to this key`] : undefined
}

function formatUsd(value: number): string {
  return `$${value.toFixed(value >= 100 ? 0 : 2)}`
}

/** Live check of a key against the provider. Never logs or returns the key. */
export async function checkProviderKey(
  provider: VoiceCredentialProvider,
  apiKey: string,
): Promise<ProviderKeyCheck> {
  const label = PROVIDER_LABEL[provider]
  const key = apiKey.trim()
  if (!key) return fail('MISSING', `No ${label} key to check.`)

  try {
    if (provider === 'google') {
      const { res, body } = await getJson(
        `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200`,
        { 'x-goog-api-key': key },
      )
      if (!res.ok) {
        const reason = JSON.stringify(body ?? '')
        if (res.status === 429 || reason.includes('RESOURCE_EXHAUSTED')) {
          return fail('QUOTA_EXCEEDED', 'Gemini quota exceeded. Wait for reset or enable billing.')
        }
        if (res.status === 400 || reason.includes('API_KEY_INVALID')) {
          return fail('INVALID', 'Gemini rejected this key (invalid or revoked).')
        }
        return failFromStatus(label, res.status)
      }
      return { valid: true, code: 'VALID', message: 'Gemini key works.', details: modelDetails(body) }
    }

    if (provider === 'anthropic') {
      const { res, body } = await getJson('https://api.anthropic.com/v1/models?limit=100', {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      })
      if (!res.ok) return failFromStatus(label, res.status)
      return { valid: true, code: 'VALID', message: 'Claude key works.', details: modelDetails(body) }
    }

    if (provider === 'openrouter') {
      // /models is public, so it cannot prove a key; /key is authenticated and reports credit.
      const { res, body } = await getJson('https://openrouter.ai/api/v1/key', {
        Authorization: `Bearer ${key}`,
      })
      if (!res.ok) return failFromStatus(label, res.status)
      const data = (body as { data?: Record<string, unknown> } | null)?.data ?? {}
      const details: string[] = []
      const usage = typeof data.usage === 'number' ? data.usage : null
      const limit = typeof data.limit === 'number' ? data.limit : null
      const remaining = typeof data.limit_remaining === 'number' ? data.limit_remaining : null
      if (usage !== null) details.push(`${formatUsd(usage)} spent on this key`)
      if (remaining !== null && limit !== null) details.push(`${formatUsd(remaining)} of ${formatUsd(limit)} limit left`)
      else details.push('No spending limit on this key')
      if (data.is_free_tier === true) details.push('Free tier: only free models will run')
      return { valid: true, code: 'VALID', message: 'OpenRouter key works.', details }
    }

    if (provider === 'deepgram') {
      const { res } = await getJson('https://api.deepgram.com/v1/projects', { Authorization: `Token ${key}` })
      if (!res.ok) return failFromStatus(label, res.status)
      return { valid: true, code: 'VALID', message: 'Deepgram key works.' }
    }

    const bearerModelsUrl: Record<'openai' | 'xai' | 'deepseek' | 'kimi' | 'fish', string> = {
      openai: 'https://api.openai.com/v1/models',
      xai: 'https://api.x.ai/v1/models',
      deepseek: 'https://api.deepseek.com/v1/models',
      kimi: 'https://api.moonshot.ai/v1/models',
      fish: 'https://api.fish.audio/model?page_size=1',
    }
    const { res, body } = await getJson(bearerModelsUrl[provider], { Authorization: `Bearer ${key}` })
    if (!res.ok) return failFromStatus(label, res.status)
    return {
      valid: true,
      code: 'VALID',
      message: `${label} key works.`,
      details: provider === 'fish' ? undefined : modelDetails(body),
    }
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError'
    return fail('NETWORK', timedOut ? `${label} did not answer in time. Try again.` : `Could not reach ${label}.`)
  }
}
