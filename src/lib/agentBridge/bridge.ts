import 'server-only'
import type { Prisma } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { decryptToken, encryptToken } from '@/lib/messages/encrypt'
import { sha256 } from '@/lib/cli/cliAuth'
import { findAgentTool } from './registry'
import { AgentInputError, type AgentContext, type AgentWriteTool } from './types'

/**
 * Write requests: the agent asks, the creator allows (Lead → Approval), then the change is
 * applied. "Always allow <tool>" skips the asking for that tool from then on.
 */

const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000
const RESULT_MAX_CHARS = 20_000

/** Every write tool also takes these, so requests are grouped and explained. */
export const WRITE_TOOL_EXTRA_PROPERTIES = {
  task: { type: 'string', description: 'Short title of what you are working on, e.g. "Refine FAQ from our chat". Groups your requests.' },
  why: { type: 'string', description: 'One or two sentences on why this change is needed. The creator reads it before approving.' },
} as const

function jsonSafe(value: unknown): Prisma.InputJsonValue {
  try {
    const text = JSON.stringify(value ?? null)
    if (text.length <= RESULT_MAX_CHARS) return JSON.parse(text) as Prisma.InputJsonValue
    return { truncated: text.slice(0, RESULT_MAX_CHARS) }
  } catch {
    return { value: String(value) }
  }
}

export type RequestOutcome = {
  requestId: string
  status: 'PENDING' | 'APPLIED' | 'FAILED'
  result?: unknown
  error?: string
}

/** Turns a write call into a request; applies it at once if the creator always allows the tool. */
export async function submitWriteRequest(
  ctx: AgentContext,
  tool: AgentWriteTool,
  input: Record<string, unknown>,
): Promise<RequestOutcome> {
  const task = typeof input.task === 'string' && input.task.trim() ? input.task.trim().slice(0, 200) : 'Agent request'
  const why = typeof input.why === 'string' && input.why.trim() ? input.why.trim().slice(0, 1000) : null
  const { task: _task, why: _why, ...toolInput } = input
  void _task
  void _why

  const proposal = await tool.propose(ctx, toolInput)
  const request = await prismaClient.agentRequest.create({
    data: {
      userId: ctx.userId,
      tokenId: ctx.tokenId || null,
      client: ctx.client.slice(0, 16),
      runId: sha256(`${ctx.tokenId || ctx.client}:${task.toLowerCase()}`).slice(0, 32),
      runTitle: task,
      area: tool.area,
      tool: tool.name,
      title: proposal.title.slice(0, 200),
      detail: proposal.detail?.slice(0, 500) || null,
      reason: why,
      input: jsonSafe({ display: proposal.display, payload: proposal.payload }),
      secretEnc: proposal.secrets && Object.keys(proposal.secrets).length ? encryptToken(JSON.stringify(proposal.secrets)) : null,
    },
    select: { id: true },
  })

  if (tool.policy === 'direct') return applyRequest(ctx.userId, request.id, { auto: true })
  const granted = await prismaClient.agentToolGrant.findUnique({
    where: { userId_tool: { userId: ctx.userId, tool: tool.name } },
    select: { id: true },
  })
  if (!granted) return { requestId: request.id, status: 'PENDING' }
  return applyRequest(ctx.userId, request.id, { auto: true })
}

/** Runs one approved request. Safe against double clicks: only PENDING → APPLYING wins. */
export async function applyRequest(userId: string, requestId: string, opts: { auto?: boolean } = {}): Promise<RequestOutcome> {
  const claimed = await prismaClient.agentRequest.updateMany({
    where: { id: requestId, userId, status: 'PENDING' },
    data: { status: 'APPLYING', decidedAt: new Date(), autoApproved: Boolean(opts.auto) },
  })
  if (claimed.count === 0) throw new AgentInputError('That request was already handled.')

  const request = await prismaClient.agentRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: { tool: true, input: true, secretEnc: true, tokenId: true, client: true },
  })
  const tool = findAgentTool(request.tool)
  const finish = (data: Prisma.AgentRequestUpdateInput) =>
    prismaClient.agentRequest.update({ where: { id: requestId }, data: { ...data, secretEnc: null } })

  if (!tool || tool.kind !== 'write') {
    await finish({ status: 'FAILED', error: 'This kind of change is no longer supported.' })
    return { requestId, status: 'FAILED', error: 'This kind of change is no longer supported.' }
  }
  const stored = (request.input ?? {}) as { payload?: Record<string, unknown> }
  let secrets: Record<string, string> = {}
  if (request.secretEnc) {
    try {
      secrets = JSON.parse(decryptToken(request.secretEnc) ?? '{}')
    } catch {
      secrets = {}
    }
  }
  try {
    const result = await tool.apply({ userId, tokenId: request.tokenId ?? '', client: request.client }, stored.payload ?? {}, secrets)
    await finish({ status: 'APPLIED', result: jsonSafe(result) })
    return { requestId, status: 'APPLIED', result }
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 1000)
    await finish({ status: 'FAILED', error: message })
    return { requestId, status: 'FAILED', error: message }
  }
}

export async function denyRequests(userId: string, ids: string[], note: string | null): Promise<number> {
  const updated = await prismaClient.agentRequest.updateMany({
    where: { id: { in: ids }, userId, status: 'PENDING' },
    data: { status: 'DENIED', note: note?.slice(0, 1000) || null, decidedAt: new Date(), secretEnc: null },
  })
  return updated.count
}

export async function grantTools(userId: string, tools: string[]) {
  for (const tool of new Set(tools)) {
    await prismaClient.agentToolGrant.upsert({
      where: { userId_tool: { userId, tool } },
      create: { userId, tool },
      update: {},
    })
  }
}

/** Pending requests for the Approval page (old ones expire first). */
export async function loadPendingRequests(userId: string) {
  await prismaClient.agentRequest.updateMany({
    where: { userId, status: 'PENDING', createdAt: { lt: new Date(Date.now() - PENDING_TTL_MS) } },
    data: { status: 'EXPIRED', secretEnc: null, decidedAt: new Date() },
  })
  return prismaClient.agentRequest.findMany({
    where: { userId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      runId: true,
      runTitle: true,
      area: true,
      tool: true,
      title: true,
      detail: true,
      reason: true,
      input: true,
      client: true,
      createdAt: true,
    },
  })
}

export async function loadRecentDecisions(userId: string, limit = 20) {
  return prismaClient.agentRequest.findMany({
    where: { userId, status: { in: ['APPLIED', 'FAILED', 'DENIED', 'EXPIRED'] } },
    orderBy: { decidedAt: 'desc' },
    take: limit,
    select: { id: true, tool: true, title: true, detail: true, status: true, error: true, note: true, autoApproved: true, decidedAt: true, runTitle: true },
  })
}

export async function loadToolGrants(userId: string) {
  return prismaClient.agentToolGrant.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { id: true, tool: true, createdAt: true } })
}

export async function revokeToolGrant(userId: string, grantId: string) {
  await prismaClient.agentToolGrant.deleteMany({ where: { id: grantId, userId } })
}
