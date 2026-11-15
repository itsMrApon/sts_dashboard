import 'server-only'
import type { Prisma } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { resolveRoomOwnerUserId } from '@/lib/messages/resolveRoomOwnerUserId'

export type AgentEditAccess =
  | { ok: true; agentId: string; roomName: string; claimed: boolean }
  | { ok: false; reason: 'NOT_FOUND' | 'FORBIDDEN' }

/**
 * Can `userId` edit this LiveKit agent?
 * - Owned agents: only the owner.
 * - Legacy agents (userId NULL): the owner implied by business/channel links, if any; when nothing
 *   links the agent to anyone, the first authorized editor claims it. Claiming is idempotent and
 *   race-safe (the conditional update only matches while userId is still NULL).
 */
export async function ensureAgentEditAccess(agentId: string, userId: string): Promise<AgentEditAccess> {
  const agent = await prismaClient.liveKitAgent.findUnique({
    where: { id: agentId },
    select: { id: true, roomName: true, userId: true },
  })
  if (!agent) return { ok: false, reason: 'NOT_FOUND' }
  if (agent.userId) {
    return agent.userId === userId
      ? { ok: true, agentId: agent.id, roomName: agent.roomName, claimed: false }
      : { ok: false, reason: 'FORBIDDEN' }
  }

  const impliedOwner = await resolveRoomOwnerUserId(agent.id, agent.roomName)
  if (impliedOwner && impliedOwner !== userId) return { ok: false, reason: 'FORBIDDEN' }

  const claim = await prismaClient.liveKitAgent.updateMany({
    where: { id: agent.id, userId: null },
    data: { userId },
  })
  if (claim.count === 0) {
    // Someone claimed it between our read and write; re-check against the winner.
    const current = await prismaClient.liveKitAgent.findUnique({
      where: { id: agent.id },
      select: { userId: true },
    })
    if (current?.userId !== userId) return { ok: false, reason: 'FORBIDDEN' }
  }
  return { ok: true, agentId: agent.id, roomName: agent.roomName, claimed: claim.count > 0 }
}

/**
 * The assistants a creator sees and may use: their own, plus classic unowned ones, minus any
 * already running someone else's business. Same rule for /ai-agents and every service picker.
 */
export function myAssistantsWhere(userId: string): Prisma.LiveKitAgentWhereInput {
  return {
    AND: [
      { OR: [{ userId }, { userId: null }] },
      { NOT: { publishAgents: { some: { publishProfile: { userId: { not: userId } } } } } },
    ],
  }
}
