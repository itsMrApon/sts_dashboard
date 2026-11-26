import 'server-only'
import { prismaClient } from '@/lib/prismaClient'
import { AgentInputError, int, str, type AgentTool } from '../types'

const VIEW = {
  id: true,
  tool: true,
  title: true,
  detail: true,
  status: true,
  note: true,
  result: true,
  error: true,
  createdAt: true,
  decidedAt: true,
} as const

/** How the agent finds out what happened to the changes it asked for. */
export const REQUEST_TOOLS: AgentTool[] = [
  {
    kind: 'read',
    name: 'get_request_status',
    area: 'requests',
    title: 'Status of a change request',
    description:
      'Whether the creator allowed a change you asked for: PENDING, APPLIED (with the result), FAILED (with the error), DENIED (with their note: do what it says instead) or EXPIRED.',
    inputSchema: {
      type: 'object',
      properties: { request_id: { type: 'string' } },
      required: ['request_id'],
      additionalProperties: false,
    },
    async run(ctx, input) {
      const id = str(input, 'request_id', { max: 64, required: true })
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AgentInputError('request_id is not valid.')
      const request = await prismaClient.agentRequest.findFirst({ where: { id, userId: ctx.userId }, select: VIEW })
      if (!request) throw new AgentInputError('No request with that id.')
      return { text: JSON.stringify(request, null, 2), structured: request as unknown as Record<string, unknown> }
    },
  },
  {
    kind: 'read',
    name: 'list_my_requests',
    area: 'requests',
    title: 'Recent change requests',
    description: 'The latest changes you asked for and their status, newest first.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Default 10.' } },
      additionalProperties: false,
    },
    async run(ctx, input) {
      const requests = await prismaClient.agentRequest.findMany({
        where: { userId: ctx.userId, tokenId: ctx.tokenId },
        orderBy: { createdAt: 'desc' },
        take: int(input, 'limit', { min: 1, max: 50, fallback: 10 }),
        select: VIEW,
      })
      if (requests.length === 0) return 'No requests yet.'
      return { text: JSON.stringify(requests, null, 2), structured: { requests } }
    },
  },
]
