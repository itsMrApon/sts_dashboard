'use server'

import { revalidatePath } from 'next/cache'
import { onAuthenticateUser } from '@/actions/auth'
import { prismaClient } from '@/lib/prismaClient'
import { applyRequest, denyRequests, grantTools, revokeToolGrant } from '@/lib/agentBridge/bridge'
import { AgentInputError } from '@/lib/agentBridge/types'
import { findLeadMatches } from '@/lib/leads/leadMatches'

type Outcome = { id: string; title: string; status: 'APPLIED' | 'FAILED' | 'SKIPPED'; error?: string }
type Result<T> = { ok: true; data: T } | { ok: false; error: string }

const MAX_BATCH = 50

async function currentUserId() {
  const auth = await onAuthenticateUser()
  return auth.user?.id ?? null
}

function cleanIds(ids: string[]): string[] {
  return [...new Set(ids.filter((id) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)))].slice(0, MAX_BATCH)
}

/** Allows requests (once, or always for their tools) and applies them one by one. */
export async function approveAgentRequests(input: { ids: string[]; scope: 'once' | 'always' }): Promise<Result<Outcome[]>> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  const ids = cleanIds(input.ids)
  const rows = await prismaClient.agentRequest.findMany({ where: { id: { in: ids }, userId }, select: { id: true, tool: true, title: true, detail: true } })
  if (input.scope === 'always') await grantTools(userId, rows.map((r) => r.tool))

  const outcomes: Outcome[] = []
  for (const row of rows) {
    const label = row.detail ? `${row.title} ${row.detail}` : row.title
    try {
      const outcome = await applyRequest(userId, row.id)
      outcomes.push({ id: row.id, title: label, status: outcome.status === 'APPLIED' ? 'APPLIED' : 'FAILED', error: outcome.error })
    } catch (error) {
      outcomes.push({ id: row.id, title: label, status: 'SKIPPED', error: error instanceof AgentInputError ? error.message : 'Could not apply.' })
    }
  }
  revalidatePath('/lead/approval')
  return { ok: true, data: outcomes }
}

/** Denies requests; the note goes back to the agent ("do this instead…"). */
export async function denyAgentRequests(input: { ids: string[]; note?: string }): Promise<Result<number>> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  const count = await denyRequests(userId, cleanIds(input.ids), input.note?.trim() || null)
  revalidatePath('/lead/approval')
  return { ok: true, data: count }
}

/** Stops auto-allowing a tool: its next requests wait for approval again. */
export async function revokeAgentToolGrant(input: { id: string }): Promise<Result<null>> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  await revokeToolGrant(userId, input.id)
  revalidatePath('/lead/approval')
  return { ok: true, data: null }
}

/** Lead → Approval "Find matches": the AI looks for leads that need what you sell. */
export async function findLeadMatchesAction(): Promise<Result<{ looked: number; matched: number }>> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  try {
    const data = await findLeadMatches(userId)
    revalidatePath('/lead/approval')
    return { ok: true, data }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not look for matches. Try again.' }
  }
}
