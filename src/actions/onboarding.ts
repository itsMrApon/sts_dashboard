'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { onAuthenticateUser } from '@/actions/auth'
import { saveBusinessLookupTags } from '@/actions/businessSite'
import { saveProviderKey } from '@/actions/voiceCredentials'
import { isAssistantService, type AssistantService } from '@/lib/agents/assistantServices'
import { getCreatorBusiness, setOnboardingStep } from '@/lib/business/creatorBusiness'
import { isOnboardingResumeStep, onboardingRank } from '@/lib/business/onboarding'
import { resolveUserProviderKey } from '@/lib/credentials/providerKeys'
import { getFirstAgentBuild, markFirstAgentBuilding, runFirstAgentBuild, type FirstAgentBuild } from '@/lib/onboarding/firstAgent'
import { applyStarterEngine, ensureGuideAgent } from '@/lib/onboarding/setupGuide'

type KeyField = 'gemini' | 'cartesia'
export type ConnectKeysResult = { ok: true } | { ok: false; errors: Partial<Record<KeyField | 'form', string>> }

/**
 * Card 1: the two free keys. Each is checked with its provider and saved, the starter engine
 * (Gemini thinks, Cartesia hears and speaks) becomes the Config default, and the setup wizard is
 * created.
 * A field left empty keeps the key already saved.
 */
export async function connectStarterKeys(input: {
  geminiKey?: string
  cartesiaKey?: string
}): Promise<ConnectKeysResult> {
  const auth = await onAuthenticateUser()
  if (!auth.user) return { ok: false, errors: { form: 'Please sign in again.' } }
  const userId = auth.user.id

  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
  const fields: { field: KeyField; provider: 'google' | 'cartesia'; value: string }[] = [
    { field: 'gemini', provider: 'google', value: text(input.geminiKey) },
    { field: 'cartesia', provider: 'cartesia', value: text(input.cartesiaKey) },
  ]
  const results = await Promise.all(
    fields.map(async ({ field, provider, value }) => {
      if (!value) return (await resolveUserProviderKey(userId, provider)) ? null : ([field, 'Paste your key'] as const)
      const saved = await saveProviderKey({ provider, apiKey: value })
      if (!saved.ok) return [field, saved.error] as const
      if (!saved.saved) return [field, saved.check.message || 'This key was rejected'] as const
      return null
    }),
  )
  const errors = Object.fromEntries(results.filter((item) => item !== null))
  if (Object.keys(errors).length) return { ok: false, errors }

  try {
    await applyStarterEngine(userId)
    await ensureGuideAgent(userId)
  } catch (error) {
    console.error('[connectStarterKeys]', error)
    return { ok: false, errors: { form: 'Keys saved, but setup stopped. Try again.' } }
  }
  revalidatePath('/ai-agents', 'layout')
  return { ok: true }
}

/** Moves saved setup progress forward (agent → tools → finish). Never backwards. */
export async function advanceOnboarding(step: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isOnboardingResumeStep(step)) return { ok: false, error: 'Unknown step' }
  const auth = await onAuthenticateUser()
  if (!auth.user) return { ok: false, error: 'UNAUTHENTICATED' }
  const business = await getCreatorBusiness(auth.user.id)
  if (!business?.onboardingStep) return { ok: true }
  if (onboardingRank(step) > onboardingRank(business.onboardingStep)) await setOnboardingStep(business.workspaceId, step)
  return { ok: true }
}

const TONE_IDS = ['friendly', 'professional', 'casual', 'enthusiastic']
const GOAL_IDS = ['answer', 'leads', 'book', 'sell']

/**
 * "Build agent": saves the tags, then writes and creates the agent after the response, so the
 * creator moves on to Tools right away. Progress: getFirstAgentStatus.
 */
export async function startFirstAgent(input: {
  service: AssistantService
  tags: string[]
  goals: string[]
  tone: string
  language: 'en' | 'bn' | 'both'
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await onAuthenticateUser()
  if (!auth.user) return { ok: false, error: 'UNAUTHENTICATED' }
  const userId = auth.user.id
  const business = await getCreatorBusiness(userId)
  if (!business) return { ok: false, error: 'Create your business first.' }
  if (!isAssistantService(input.service)) return { ok: false, error: 'Pick a service' }

  const tags = (Array.isArray(input.tags) ? input.tags : []).filter((tag): tag is string => typeof tag === 'string').slice(0, 12)
  if (tags.length) {
    const saved = await saveBusinessLookupTags({ tags })
    if (!saved.ok) return saved
  }

  const build = {
    userId,
    workspaceId: business.workspaceId,
    businessName: business.name,
    service: input.service,
    goals: (Array.isArray(input.goals) ? input.goals : []).filter((goal) => GOAL_IDS.includes(goal)),
    tone: TONE_IDS.includes(input.tone) ? input.tone : 'friendly',
    language: input.language === 'bn' || input.language === 'both' ? input.language : ('en' as const),
  }
  markFirstAgentBuilding(userId, input.service)
  after(() => runFirstAgentBuild(build))
  return { ok: true }
}

/** The background build's progress, for the Tools and Finish cards. */
export async function getFirstAgentStatus(): Promise<FirstAgentBuild | null> {
  const auth = await onAuthenticateUser()
  if (!auth.user) return null
  return getFirstAgentBuild(auth.user.id)
}

/** "Go to home": marks setup done and redirects in the same response (one round trip). */
export async function finishOnboarding(): Promise<{ ok: false; error: string }> {
  const auth = await onAuthenticateUser()
  if (!auth.user) return { ok: false, error: 'UNAUTHENTICATED' }
  const business = await getCreatorBusiness(auth.user.id)
  if (!business) return { ok: false, error: 'Create your business first.' }
  try {
    if (business.onboardingStep) await setOnboardingStep(business.workspaceId, null)
  } catch (error) {
    console.error('[finishOnboarding]', error)
    return { ok: false, error: 'Could not finish setup. Please try again.' }
  }
  redirect('/home')
}
