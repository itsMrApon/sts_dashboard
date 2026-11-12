'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { onAuthenticateUser } from '@/actions/auth'
import type { AgentEngine } from '@/lib/agents/engineOptions'
import { getEngineForUser, saveEngineForUser, type EngineSource } from '@/lib/agents/engineSettings'
import { fetchOpenRouterModels, fetchXaiModels, type OpenRouterModel } from '@/lib/llm/openRouterModels'
import { resolveProviderKey } from '@/lib/credentials/providerKeys'
import { getUserVoiceCredentialByUserId } from '@/lib/voiceCredentialsRepo'

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string }

export type AgentEngineView = {
  engine: AgentEngine
  source: EngineSource
  voiceLabel: string | null
}

/** Account-wide LLM + voice engine for the signed-in user (AI Agents → Config). */
export async function getAgentEngineSettings(): Promise<ActionResult<AgentEngineView>> {
  const authResult = await onAuthenticateUser()
  const userId = authResult.user?.id
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' }
  try {
    return { ok: true, ...(await getEngineForUser(userId)) }
  } catch (error) {
    console.error('[getAgentEngineSettings]', error)
    return { ok: false, error: 'Could not load AI engine settings.' }
  }
}

export async function saveAgentEngineSettings(
  input: Partial<Record<keyof AgentEngine, unknown>> & { voiceLabel?: string | null },
): Promise<ActionResult<{ engine: AgentEngine; agentsUpdated: number }>> {
  const authResult = await onAuthenticateUser()
  const userId = authResult.user?.id
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' }
  try {
    const result = await saveEngineForUser(userId, input)
    if (!result.ok) return result
    revalidateTag('livekit-agents')
    revalidatePath('/settings')
    revalidatePath('/ai-agents')
    revalidatePath('/ai-agents/config')
    return { ok: true, engine: result.engine, agentsUpdated: result.agentsUpdated }
  } catch (error) {
    console.error('[saveAgentEngineSettings]', error)
    return { ok: false, error: 'Could not save AI engine settings.' }
  }
}

/** Grok text models available to the user's xAI key (saved or .env). Empty when there is no key. */
export async function listXaiModels(): Promise<ActionResult<{ models: { id: string }[] }>> {
  const authResult = await onAuthenticateUser()
  const userId = authResult.user?.id
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' }
  const row = await getUserVoiceCredentialByUserId(userId)
  const { key } = resolveProviderKey(row, 'xai')
  if (!key) return { ok: true, models: [] }
  return { ok: true, models: await fetchXaiModels(key) }
}

/** OpenRouter's live model catalog for the Settings model picker (public data, cached 1h). */
export async function listOpenRouterModels(): Promise<ActionResult<{ models: OpenRouterModel[] }>> {
  const authResult = await onAuthenticateUser()
  if (!authResult.user?.id) return { ok: false, error: 'UNAUTHENTICATED' }
  return { ok: true, models: await fetchOpenRouterModels() }
}
