import 'server-only'
import { brainToMarkdown, loadApprovedReviews, loadBusinessBrain } from './businessBrain'

/**
 * A small, stateless MCP server (Streamable HTTP transport, JSON responses, no SSE) for the
 * creator's own AI agent: Claude Code, Codex or Cursor, set up by `npx @sts-ai/cli init`.
 * Everything is read-only and scoped to the user behind the bearer token.
 */

export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const
const SERVER_INFO = { name: 'sts-ai', title: 'sts-ai business brain', version: '1.0.0' }

const INSTRUCTIONS = [
  'This server is the creator’s sts-ai business brain: their business profile, offers and prices,',
  'links, social accounts and approved customer reviews. Call get_business_brain before writing any',
  'content for the business, and use it as the source of truth. Never invent prices, offers or claims.',
  'Keep Bangla text exactly as written.',
].join(' ')

type JsonRpcId = string | number | null
type JsonRpcMessage = { jsonrpc?: string; id?: JsonRpcId; method?: string; params?: Record<string, unknown> }
export type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: JsonRpcId; result: unknown }
  | { jsonrpc: '2.0'; id: JsonRpcId; error: { code: number; message: string } }

const TOOLS = [
  {
    name: 'get_business_brain',
    title: 'Business brain',
    description:
      'Everything about the creator’s business in one markdown document: name, description, business page, offers with links and prices, social accounts, latest approved reviews and the business knowledge their own AI assistant uses. Call this first.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'list_offers',
    title: 'Offers and links',
    description: 'The business’s live offers (products, services, webinars, projects) with their public page and buy links, as JSON.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'list_reviews',
    title: 'Approved reviews',
    description: 'Customer reviews the creator approved for public use, newest first. Reviewers are shown by first name only.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 50, description: 'How many reviews (default 20).' } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
] as const

const BRAIN_URI = 'sts-ai://business/brain'

const ok = (id: JsonRpcId, result: unknown): JsonRpcResponse => ({ jsonrpc: '2.0', id, result })
const fail = (id: JsonRpcId, code: number, message: string): JsonRpcResponse => ({ jsonrpc: '2.0', id, error: { code, message } })
const text = (value: string) => ({ content: [{ type: 'text', text: value }] })

const NO_BUSINESS = 'This account has no business set up yet. Finish onboarding in sts-ai first.'

async function callTool(userId: string, name: string, args: Record<string, unknown>) {
  if (name === 'get_business_brain') {
    const [brain, reviews] = await Promise.all([loadBusinessBrain(userId), loadApprovedReviews(userId, 5)])
    if (!brain) return { ...text(NO_BUSINESS), isError: true }
    return text(brainToMarkdown(brain, reviews))
  }
  if (name === 'list_offers') {
    const brain = await loadBusinessBrain(userId)
    if (!brain) return { ...text(NO_BUSINESS), isError: true }
    const offers = { businessPageUrl: brain.businessPageUrl, primaryOfferUrl: brain.primaryOfferUrl, offers: brain.offers }
    return { ...text(JSON.stringify(offers, null, 2)), structuredContent: offers }
  }
  if (name === 'list_reviews') {
    const limit = typeof args.limit === 'number' && Number.isFinite(args.limit) ? Math.round(args.limit) : 20
    const reviews = await loadApprovedReviews(userId, limit)
    return { ...text(reviews.length ? JSON.stringify(reviews, null, 2) : 'No approved reviews yet.'), structuredContent: { reviews } }
  }
  return null
}

/** Handles one JSON-RPC message. Returns null for notifications (no reply). */
export async function handleMcpMessage(userId: string, message: JsonRpcMessage): Promise<JsonRpcResponse | null> {
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
      return ok(id, { tools: TOOLS })
    case 'tools/call': {
      const name = typeof params.name === 'string' ? params.name : ''
      const args = params.arguments && typeof params.arguments === 'object' ? (params.arguments as Record<string, unknown>) : {}
      const result = await callTool(userId, name, args)
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
      const [brain, reviews] = await Promise.all([loadBusinessBrain(userId), loadApprovedReviews(userId, 5)])
      if (!brain) return fail(id, -32002, NO_BUSINESS)
      return ok(id, { contents: [{ uri: BRAIN_URI, mimeType: 'text/markdown', text: brainToMarkdown(brain, reviews) }] })
    }
    case 'prompts/list':
      return ok(id, { prompts: [] })
    default:
      return fail(id, -32601, `Method not found: ${message.method}`)
  }
}
