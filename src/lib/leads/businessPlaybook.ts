import 'server-only'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'
import { buildAgentContext } from '@/lib/messages/buildAgentContext'
import { prismaClient } from '@/lib/prismaClient'

/**
 * What the business sells and how it talks, used as the yardstick for scoring leads: Playbook fit
 * (website scan vs the business) and Call review (call vs the business). It is the same business
 * knowledge the AI assistants are given (profile, products, FAQs, policies), so there is nothing
 * to pick per lead.
 */
export type BusinessPlaybook = {
  /** The business knowledge as one instruction text. */
  text: string
  /** The business's own agent: scores are filed under it. */
  agentId: string
  name: string
  llmModel: string | null
}

export async function loadBusinessPlaybook(userId: string): Promise<BusinessPlaybook | null> {
  const business = await getCreatorBusiness(userId)
  if (!business) return null
  const [context, agent] = await Promise.all([
    buildAgentContext(business.roomName),
    prismaClient.liveKitAgent.findUnique({ where: { id: business.agentId }, select: { llmModel: true } }),
  ])
  const text = context.systemInstruction.trim()
  if (!text) return null
  return { text, agentId: business.agentId, name: business.name, llmModel: agent?.llmModel ?? null }
}

export const NO_PLAYBOOK_ERROR = 'Add your business details first (Services → Menu and Contact), then score again.'
