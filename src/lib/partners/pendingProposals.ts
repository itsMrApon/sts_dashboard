import type { PendingProposal, PendingProposalTool } from './types'

const TTL_MS = 10 * 60 * 1000
const store = new Map<string, PendingProposal>()

function pruneExpired() {
  const now = Date.now()
  for (const [id, proposal] of store) {
    if (proposal.expiresAt <= now) store.delete(id)
  }
}

export function createPendingProposal(input: {
  sessionId: string
  workspaceId: string
  userId: string
  summary: string
  tools: PendingProposalTool[]
}): PendingProposal {
  pruneExpired()
  const now = Date.now()
  const proposal: PendingProposal = {
    id: crypto.randomUUID(),
    sessionId: input.sessionId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    summary: input.summary,
    tools: input.tools,
    createdAt: now,
    expiresAt: now + TTL_MS,
  }
  store.set(proposal.id, proposal)
  return proposal
}

export function getPendingProposal(id: string): PendingProposal | null {
  pruneExpired()
  const proposal = store.get(id)
  if (!proposal) return null
  if (proposal.expiresAt <= Date.now()) {
    store.delete(id)
    return null
  }
  return proposal
}

export function consumePendingProposal(id: string): PendingProposal | null {
  const proposal = getPendingProposal(id)
  if (!proposal) return null
  store.delete(id)
  return proposal
}

export function cancelPendingProposal(id: string, sessionId: string, userId: string): boolean {
  const proposal = getPendingProposal(id)
  if (!proposal) return false
  if (proposal.sessionId !== sessionId || proposal.userId !== userId) return false
  store.delete(id)
  return true
}
