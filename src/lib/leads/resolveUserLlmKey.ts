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
 * The creator's own Gemini key from Config Agent (encrypted). No server .env fallback:
 * creators bring their own keys.
 */
export async function resolveUserGeminiApiKey(
  userId: string,
): Promise<string | null> {
  const row = await getUserVoiceCredentialByUserId(userId)
  return safeDecrypt(row?.googleApiKey)?.trim() || null
}

export async function userHasLlmKeys(userId: string): Promise<{
  hasGemini: boolean
  hasOpenAi: boolean
  hasAnthropic: boolean
}> {
  const row = await getUserVoiceCredentialByUserId(userId)
  return {
    hasGemini: Boolean(safeDecrypt(row?.googleApiKey)?.trim()),
    hasOpenAi: Boolean(safeDecrypt(row?.openaiApiKey)?.trim()),
    hasAnthropic: Boolean(safeDecrypt(row?.anthropicApiKey)?.trim()),
  }
}
