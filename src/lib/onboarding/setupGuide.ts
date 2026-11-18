import 'server-only'
import type { Prisma } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { DEFAULT_AGENT_ENGINE, DEFAULT_CARTESIA_VOICE } from '@/lib/agents/engineOptions'
import { getEngineForUser, saveEngineForUser } from '@/lib/agents/engineSettings'
import { GUIDE_LINES } from '@/lib/onboarding/guideLines'

/** The wizard's voice: Cartesia Sonic, the same default voice new agents speak with. */
export const GUIDE_VOICE = DEFAULT_CARTESIA_VOICE

/** Marks the guide among the creator's agents (serviceSettings.role). */
const GUIDE_ROLE = 'guide'

const GUIDE_PROMPT = [
  'You are the setup wizard for this workspace. You guide the creator, not their visitors.',
  'Explain each part of the app in one or two short sentences: the business, agents (one per service, each with its own persona, prompt and behaviour), tools and integrations, and the keys in Config.',
  'Always point to the next step. Be plain and friendly. Never invent features.',
  'Reply in the language the creator uses (Bangla or English).',
].join('\n')

/** The creator's guide agent, if it exists. */
export async function findGuideAgent(userId: string) {
  return prismaClient.liveKitAgent.findFirst({
    where: { userId, serviceSettings: { path: ['role'], equals: GUIDE_ROLE } },
    select: { id: true, name: true },
  })
}

/**
 * Creates the wizard that speaks through setup. It stays in AI Agents as its own agent, next to
 * the business agent, and runs no service until the creator assigns one. Idempotent.
 */
export async function ensureGuideAgent(userId: string): Promise<{ id: string; name: string }> {
  const existing = await findGuideAgent(userId)
  if (existing) return existing
  const { engine } = await getEngineForUser(userId)
  return prismaClient.liveKitAgent.create({
    data: {
      userId,
      name: 'Wizard',
      roomName: `wizard-${Math.random().toString(36).slice(2, 10)}`,
      service: 'tour',
      serviceSettings: { role: GUIDE_ROLE } as Prisma.InputJsonObject,
      systemPrompt: GUIDE_PROMPT,
      firstMessage: GUIDE_LINES.name,
      language: 'en',
      llmProvider: engine.llmProvider,
      llmModel: engine.llmModel,
      voiceProvider: 'cartesia',
      voiceModel: GUIDE_VOICE,
    },
    select: { id: true, name: true },
  })
}

/**
 * First keys in: Gemini thinks, Cartesia hears and speaks. Only when the creator hasn't saved an
 * engine yet, so a choice made in Config is never overwritten.
 */
export async function applyStarterEngine(userId: string): Promise<void> {
  const { source } = await getEngineForUser(userId)
  if (source === 'settings') return
  const saved = await saveEngineForUser(userId, { ...DEFAULT_AGENT_ENGINE })
  if (!saved.ok) console.warn('[applyStarterEngine]', saved.error)
}
