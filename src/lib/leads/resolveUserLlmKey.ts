import { decryptToken } from '@/lib/messages/encrypt'
import { getUserVoiceCredentialByUserId } from '@/lib/voiceCredentialsRepo'

function safeDecrypt(value: string | null | undefined): string | null {
  try {
    return decryptToken(value)
  } catch {
    return null
  }
}

/**
 * Resolve Gemini API key the same way chat / Config Agent does:
 * UserVoiceCredential (encrypted) → GOOGLE_API_KEY env fallback.
 */
export async function resolveUserGeminiApiKey(
  userId: string,
): Promise<string | null> {
  const row = await getUserVoiceCredentialByUserId(userId)
  const fromDb = safeDecrypt(row?.googleApiKey)?.trim()
  if (fromDb) return fromDb
  return process.env.GOOGLE_API_KEY?.trim() || null
}

export async function userHasLlmKeys(userId: string): Promise<{
  hasGemini: boolean
  hasOpenAi: boolean
  hasAnthropic: boolean
}> {
  const row = await getUserVoiceCredentialByUserId(userId)
  return {
    hasGemini: Boolean(
      safeDecrypt(row?.googleApiKey)?.trim() ||
        process.env.GOOGLE_API_KEY?.trim(),
    ),
    hasOpenAi: Boolean(
      safeDecrypt(row?.openaiApiKey)?.trim() ||
        process.env.OPENAI_API_KEY?.trim(),
    ),
    hasAnthropic: Boolean(
      safeDecrypt(row?.anthropicApiKey)?.trim() ||
        process.env.ANTHROPIC_API_KEY?.trim(),
    ),
  }
}
