import 'server-only'
import { CARTESIA_API_VERSION } from '@/lib/credentials/providerKeys'

/**
 * Live voice catalogs for TTS providers whose voices are opaque ids (Cartesia, ElevenLabs).
 * Fetched with the creator's own key, so the picker shows exactly what that key can speak with,
 * including the creator's cloned voices.
 */

export type LibraryVoiceProvider = 'cartesia' | 'elevenlabs'
export type VoiceLanguageFilter = 'all' | 'bn' | 'en'

export type LibraryVoice = {
  id: string
  title: string
  /** ISO codes or names as the provider reports them. */
  languages: string[]
  /** The creator's own (cloned/designed) voice. */
  owned: boolean
  description: string | null
}

const LIST_TIMEOUT_MS = 8_000
const MAX_VOICES = 100

export class VoiceLibraryError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function getJson(url: string, headers: Record<string, string>, label: string): Promise<unknown> {
  const res = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(LIST_TIMEOUT_MS) })
  if (!res.ok) throw new VoiceLibraryError(`${label} voice list failed (HTTP ${res.status})`, res.status)
  return res.json()
}

const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

// --- Cartesia ----------------------------------------------------------------

type CartesiaVoice = { id?: unknown; name?: unknown; language?: unknown; is_owner?: unknown; description?: unknown }

async function listCartesia(apiKey: string, search: string, language: VoiceLanguageFilter): Promise<LibraryVoice[]> {
  const headers = { 'X-API-Key': apiKey, 'Cartesia-Version': CARTESIA_API_VERSION }
  const query = (extra: Record<string, string>) => {
    const qs = new URLSearchParams({ limit: String(MAX_VOICES), ...extra })
    if (search) qs.set('q', search)
    if (language !== 'all') qs.set('language', language)
    return `https://api.cartesia.ai/voices?${qs.toString()}`
  }
  // Owned voices first: the public catalog is large and would push clones off the first page.
  const [owned, library] = await Promise.all([
    getJson(query({ is_owner: 'true' }), headers, 'Cartesia'),
    getJson(query({}), headers, 'Cartesia'),
  ])
  const rows = [owned, library].flatMap((page) => {
    const data = (page as { data?: unknown })?.data
    return Array.isArray(data) ? (data as CartesiaVoice[]) : []
  })
  return rows.map((voice) => {
    const lang = asString(voice.language)
    return {
      id: asString(voice.id),
      title: asString(voice.name) || asString(voice.id),
      languages: lang ? [lang] : [],
      owned: voice.is_owner === true,
      description: asString(voice.description) || null,
    }
  })
}

// --- ElevenLabs ----------------------------------------------------------------

type ElevenVoice = {
  voice_id?: unknown
  name?: unknown
  category?: unknown
  description?: unknown
  labels?: Record<string, unknown>
  verified_languages?: { language?: unknown }[]
}

const ELEVEN_OWNED_CATEGORIES = new Set(['cloned', 'generated', 'professional'])

async function listElevenLabs(apiKey: string, search: string, language: VoiceLanguageFilter): Promise<LibraryVoice[]> {
  const qs = new URLSearchParams({ page_size: String(MAX_VOICES) })
  if (search) qs.set('search', search)
  const page = await getJson(`https://api.elevenlabs.io/v2/voices?${qs.toString()}`, { 'xi-api-key': apiKey }, 'ElevenLabs')
  const voices = (page as { voices?: unknown })?.voices
  const mapped = (Array.isArray(voices) ? (voices as ElevenVoice[]) : []).map((voice) => {
    const verified = (voice.verified_languages ?? []).map((item) => asString(item.language)).filter(Boolean)
    const labelLanguage = asString(voice.labels?.language)
    return {
      id: asString(voice.voice_id),
      title: asString(voice.name) || asString(voice.voice_id),
      languages: Array.from(new Set([...verified, ...(labelLanguage ? [labelLanguage] : [])])),
      owned: ELEVEN_OWNED_CATEGORIES.has(asString(voice.category)),
      description: asString(voice.description) || asString(voice.labels?.accent) || null,
    }
  })
  if (language === 'all') return mapped
  // ElevenLabs voices are multilingual; a language tag is a hint, so keep untagged voices too.
  return mapped.filter((voice) => voice.owned || voice.languages.length === 0 || voice.languages.some((lang) => lang.toLowerCase().startsWith(language)))
}

/** Owned voices first, de-duplicated, ids validated. */
export async function listLibraryVoices(input: {
  provider: LibraryVoiceProvider
  apiKey: string
  search?: string
  language?: VoiceLanguageFilter
}): Promise<LibraryVoice[]> {
  const search = (input.search ?? '').trim().slice(0, 100)
  const language = input.language ?? 'all'
  const rows =
    input.provider === 'cartesia'
      ? await listCartesia(input.apiKey, search, language)
      : await listElevenLabs(input.apiKey, search, language)

  const byId = new Map<string, LibraryVoice>()
  for (const voice of rows) {
    if (!/^[A-Za-z0-9_-]{6,100}$/u.test(voice.id)) continue
    const existing = byId.get(voice.id)
    if (!existing || (voice.owned && !existing.owned)) byId.set(voice.id, voice)
  }
  return [...byId.values()].sort((a, b) => Number(b.owned) - Number(a.owned))
}
