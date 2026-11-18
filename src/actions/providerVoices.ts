'use server'

import { onAuthenticateUser } from '@/actions/auth'
import { missingKeyMessage, PROVIDER_LABEL, resolveUserProviderKey } from '@/lib/credentials/providerKeys'
import {
  listLibraryVoices,
  VoiceLibraryError,
  type LibraryVoice,
  type LibraryVoiceProvider,
  type VoiceLanguageFilter,
} from '@/lib/voices/voiceLibrary'

export type ProviderVoicesResult = { ok: true; voices: LibraryVoice[] } | { ok: false; error: string }

const LIBRARY_PROVIDERS: LibraryVoiceProvider[] = ['cartesia', 'elevenlabs']
const LANGUAGE_FILTERS: VoiceLanguageFilter[] = ['all', 'bn', 'en']

/** Voices the signed-in creator's own Cartesia/ElevenLabs key can use, for the engine picker. */
export async function listProviderVoices(input: {
  provider: string
  search?: string
  language?: string
}): Promise<ProviderVoicesResult> {
  const provider = LIBRARY_PROVIDERS.find((item) => item === input.provider)
  if (!provider) return { ok: false, error: 'Unknown voice provider.' }
  const language = LANGUAGE_FILTERS.find((item) => item === input.language) ?? 'all'

  const auth = await onAuthenticateUser()
  if (!auth.user) return { ok: false, error: 'Please sign in again.' }

  const apiKey = await resolveUserProviderKey(auth.user.id, provider)
  if (!apiKey) return { ok: false, error: missingKeyMessage(provider) }

  try {
    const voices = await listLibraryVoices({
      provider,
      apiKey,
      search: typeof input.search === 'string' ? input.search : undefined,
      language,
    })
    return { ok: true, voices }
  } catch (error) {
    const label = PROVIDER_LABEL[provider]
    if (error instanceof VoiceLibraryError && (error.status === 401 || error.status === 403)) {
      return { ok: false, error: `${label} rejected the saved key. Update it in AI Agents → Config.` }
    }
    console.error('[listProviderVoices]', provider, error instanceof Error ? error.message : error)
    return { ok: false, error: `Could not load ${label} voices. Try again.` }
  }
}
