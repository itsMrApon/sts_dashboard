'use server'

import { revalidatePath } from 'next/cache'
import { onAuthenticateUser } from '@/actions/auth'
import { prismaClient } from '@/lib/prismaClient'
import { createCreatorBusiness, getCreatorBusiness } from '@/lib/business/creatorBusiness'

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string }

/** Onboarding: the only place a business is created (one per creator). */
export async function createMyBusiness(input: {
  name: string
  description?: string
}): Promise<ActionResult> {
  const auth = await onAuthenticateUser()
  if (!auth.user) return { ok: false, error: 'UNAUTHENTICATED' }
  if (!input.name?.trim()) return { ok: false, error: 'Business name is required' }

  try {
    await createCreatorBusiness(auth.user.id, { name: input.name, description: input.description })
  } catch (error) {
    console.error('[createMyBusiness]', error)
    return { ok: false, error: 'Could not create your business. Please try again.' }
  }
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Agents a creator may pick: unlinked ones, or ones already linked to their own business. */
async function selectableAgentWhere(userId: string) {
  return {
    OR: [{ publishAgents: { none: {} } }, { publishAgents: { some: { publishProfile: { userId } } } }],
  }
}

export async function listSelectableAgents(): Promise<{ id: string; name: string }[]> {
  const auth = await onAuthenticateUser()
  if (!auth.user) return []
  return prismaClient.liveKitAgent.findMany({
    where: await selectableAgentWhere(auth.user.id),
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  })
}

/**
 * Chooses which /ai-agents agent powers every service. The website site key moves with it
 * (embed config is keyed by the agent's room), so existing integrations keep working.
 */
export async function setBusinessAgent(agentId: string): Promise<ActionResult> {
  const auth = await onAuthenticateUser()
  if (!auth.user) return { ok: false, error: 'UNAUTHENTICATED' }
  const business = await getCreatorBusiness(auth.user.id)
  if (!business) return { ok: false, error: 'Create your business first' }
  if (agentId === business.agentId) return { ok: true }

  const agent = await prismaClient.liveKitAgent.findFirst({
    where: { id: agentId, ...(await selectableAgentWhere(auth.user.id)) },
    select: { id: true, roomName: true },
  })
  if (!agent) return { ok: false, error: 'Agent not found' }

  await prismaClient.$transaction(async (tx) => {
    await tx.publishAgent.deleteMany({ where: { publishProfileId: business.publishProfileId } })
    await tx.publishAgent.create({
      data: { publishProfileId: business.publishProfileId, agentId: agent.id, isPrimary: true },
    })
    const targetHasConfig = await tx.roomEmbedConfig.findUnique({ where: { roomName: agent.roomName }, select: { id: true } })
    if (!targetHasConfig) {
      await tx.roomEmbedConfig.updateMany({
        where: { roomName: business.roomName },
        data: { roomName: agent.roomName },
      })
    }
  })
  revalidatePath('/messages', 'layout')
  return { ok: true }
}
