import 'server-only'
import { AGENT_TOOLS, findAgentTool } from '@/lib/agentBridge/registry'
import { submitWriteRequest, WRITE_TOOL_EXTRA_PROPERTIES } from '@/lib/agentBridge/bridge'
import { AgentInputError, type AgentContext, type AgentTool } from '@/lib/agentBridge/types'
import { brainToMarkdown, loadApprovedReviews, loadBusinessBrain } from './businessBrain'

/**
 * A small, stateless MCP server (Streamable HTTP transport, JSON responses, no SSE) for the
 * creator's own AI agent: Claude Code, Codex or Cursor, set up by `npx @sts-ai/cli init`.
 * Tools come from the agent bridge registry: read tools answer at once, write tools become
 * requests the creator approves in Lead → Approval.
 */

export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const
const SERVER_INFO = { name: 'sts-ai', title: 'sts-ai business brain', version: '1.1.0' }

const INSTRUCTIONS = [
  'This server is the creator’s sts-ai account: their business brain (profile, offers, prices, links,',
  'social accounts, reviews, answers to customer questions), their integrations, leads and the Social library.',
  'Call get_business_brain before writing anything for the business and use it as the source of truth;',
  'never invent prices, offers or claims. Keep Bangla text exactly as written.',
  'Answers and the business description are saved at once (propose_answer, propose_business_description):',
  'when the creator tells you facts about their business, save them. Anything that reaches a customer',
  '(draft_reply, draft_email_to_lead) or touches connections (propose_connection, import_n8n_workflow,',
  'act_on_connection) waits for the creator in sts-ai → Lead → Approval. Pass a short `task` and a `why`;',
  'check results with get_request_status.',
].join(' ')

type JsonRpcId = string | number | null
type JsonRpcMessage = { jsonrpc?: string; id?: JsonRpcId; method?: string; params?: Record<string, unknown> }
export type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: JsonRpcId; result: unknown }
  | { jsonrpc: '2.0'; id: JsonRpcId; error: { code: number; message: string } }

const BRAIN_URI = 'sts-ai://business/brain'

const ok = (id: JsonRpcId, result: unknown): JsonRpcResponse => ({ jsonrpc: '2.0', id, result })
const fail = (id: JsonRpcId, code: number, message: string): JsonRpcResponse => ({ jsonrpc: '2.0', id, error: { code, message } })
const text = (value: string, extra?: Record<string, unknown>) => ({ content: [{ type: 'text', text: value }], ...extra })
const toolError = (message: string) => text(message, { isError: true })

function describe(tool: AgentTool) {
  if (tool.kind === 'read') {
    return {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: { readOnlyHint: true, openWorldHint: tool.area === 'integrations' },
    }
  }
  const schema = tool.inputSchema as { properties?: Record<string, unknown>; required?: string[] }
  return {
    name: tool.name,
    title: tool.title,
    description: tool.policy === 'direct' ? tool.description : `${tool.description} (Needs the creator’s approval in sts-ai → Lead → Approval.)`,
    inputSchema: { ...schema, properties: { ...(schema.properties ?? {}), ...WRITE_TOOL_EXTRA_PROPERTIES } },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: tool.area === 'integrations' },
  }
}

async function callTool(ctx: AgentContext, name: string, args: Record<string, unknown>) {
  const tool = findAgentTool(name)
  if (!tool) return null
  try {
    if (tool.kind === 'read') {
      const output = await tool.run(ctx, args)
      return typeof output === 'string' ? text(output) : text(output.text, output.structured ? { structuredContent: output.structured } : undefined)
    }
    const outcome = await submitWriteRequest(ctx, tool, args)
    const approvalUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/lead/approval`
    if (outcome.status === 'PENDING') {
      return text(
        `Request ${outcome.requestId} is waiting for the creator’s approval in sts-ai → Lead → Approval (${approvalUrl}). Nothing has changed yet. Tell the creator, then check with get_request_status.`,
        { structuredContent: { ...outcome } },
      )
    }
    if (outcome.status === 'APPLIED') {
      return text(`Done. Result: ${JSON.stringify(outcome.result ?? null)}`, {
        structuredContent: { ...outcome },
      })
    }
    return toolError(`It failed: ${outcome.error}`)
  } catch (error) {
    if (error instanceof AgentInputError) return toolError(error.message)
    console.error('[mcp/agent] tool failed', name, error)
    return toolError(error instanceof Error ? error.message : 'The tool failed.')
  }
}

/** Handles one JSON-RPC message. Returns null for notifications (no reply). */
export async function handleMcpMessage(ctx: AgentContext, message: JsonRpcMessage): Promise<JsonRpcResponse | null> {
  const isNotification = message.id === undefined
  const id = message.id ?? null
  if (message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return isNotification ? null : fail(id, -32600, 'Invalid request')
  }
  if (isNotification) return null // notifications/initialized, notifications/cancelled…

  const params = message.params ?? {}
  switch (message.method) {
    case 'initialize': {
      const requested = typeof params.protocolVersion === 'string' ? params.protocolVersion : ''
      const protocolVersion = (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
        ? requested
        : SUPPORTED_PROTOCOL_VERSIONS[0]
      return ok(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false }, resources: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      })
    }
    case 'ping':
      return ok(id, {})
    case 'tools/list':
      return ok(id, { tools: AGENT_TOOLS.map(describe) })
    case 'tools/call': {
      const name = typeof params.name === 'string' ? params.name : ''
      const args =
        params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments)
          ? (params.arguments as Record<string, unknown>)
          : {}
      const result = await callTool(ctx, name, args)
      return result ? ok(id, result) : fail(id, -32602, `Unknown tool: ${name}`)
    }
    case 'resources/list':
      return ok(id, {
        resources: [
          { uri: BRAIN_URI, name: 'business-brain', title: 'Business brain', mimeType: 'text/markdown', description: 'The creator’s business, as markdown.' },
        ],
      })
    case 'resources/templates/list':
      return ok(id, { resourceTemplates: [] })
    case 'resources/read': {
      if (params.uri !== BRAIN_URI) return fail(id, -32002, 'Resource not found')
      const [brain, reviews] = await Promise.all([loadBusinessBrain(ctx.userId), loadApprovedReviews(ctx.userId, 5)])
      if (!brain) return fail(id, -32002, 'This account has no business set up yet.')
      return ok(id, { contents: [{ uri: BRAIN_URI, mimeType: 'text/markdown', text: brainToMarkdown(brain, reviews) }] })
    }
    case 'prompts/list':
      return ok(id, { prompts: [] })
    default:
      return fail(id, -32601, `Method not found: ${message.method}`)
  }
}
