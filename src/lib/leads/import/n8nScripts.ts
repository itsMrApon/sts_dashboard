import 'server-only'
import { prismaClient } from '@/lib/prismaClient'
import { mcpCallTool, mcpListTools, openMcpSession, type McpSession } from '@/lib/partners/mcpHttpClient'
import { recordsFromPayload } from './webhookImport'

/**
 * The n8n folder on /lead/intel runs one of the creator's n8n workflows through the n8n connector
 * set up on /integrations (an MCP endpoint), and turns what it returns into rows to import.
 *
 * Two kinds of n8n MCP endpoint are handled:
 * - n8n's own instance MCP, which lists workflows (search_workflows) and runs one (execute_workflow);
 * - an "MCP Server Trigger" workflow, whose tools are the scripts themselves.
 */

export type N8nScript = {
  /** `wf:<workflow id>` or `tool:<tool name>`. */
  id: string
  name: string
  description: string | null
  /** Required text inputs the script asks for (tool mode only). */
  inputs: string[]
}

type Connector = { mcpUrl: string; authType: string; authSecret: string | null }

export async function findN8nConnector(userId: string): Promise<Connector | null> {
  return prismaClient.workspacePartnerConnector.findFirst({
    where: { userId, kind: 'n8n', enabled: true },
    orderBy: { updatedAt: 'desc' },
    select: { mcpUrl: true, authType: true, authSecret: true },
  })
}

async function session(connector: Connector): Promise<McpSession> {
  const s = await openMcpSession({
    mcpUrl: connector.mcpUrl,
    authSecret: connector.authSecret,
    authType: connector.authType,
  })
  if (!s) throw new Error('Couldn’t reach your n8n. Check its address and key in Integrations.')
  return s
}

/** Every JSON value in an MCP tool result: structured content first, then each text part that parses. */
function resultValues(result: unknown): unknown[] {
  if (!result || typeof result !== 'object') return []
  const r = result as { structuredContent?: unknown; content?: Array<{ type?: string; text?: string }> }
  const out: unknown[] = []
  if (r.structuredContent !== undefined) out.push(r.structuredContent)
  for (const part of r.content ?? []) {
    if (part?.type !== 'text' || typeof part.text !== 'string') continue
    try {
      out.push(JSON.parse(part.text))
    } catch {
      /* plain text, not data */
    }
  }
  return out
}

/** Arrays of objects anywhere inside a value, in the order they appear (n8n lists nodes in run order). */
function objectArrays(value: unknown, depth = 0, found: unknown[][] = []): unknown[][] {
  if (depth > 12 || value == null || typeof value !== 'object') return found
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every((v) => v && typeof v === 'object' && !Array.isArray(v))) found.push(value)
    for (const v of value) objectArrays(v, depth + 1, found)
    return found
  }
  for (const v of Object.values(value as Record<string, unknown>)) objectArrays(v, depth + 1, found)
  return found
}

const LEAD_KEY = /(^|[^a-z])(e-?mail|name|phone|mobile|company|business|website|url|domain)([^a-z]|$)/i

/** The array that looks most like leads; on a tie the later one, i.e. the last node that ran. */
function bestLeadRecords(values: unknown[]): Record<string, string>[] {
  let best: Record<string, string>[] = []
  let bestScore = 0
  for (const array of values.flatMap((v) => objectArrays(v))) {
    const records = recordsFromPayload(array)
    if (records.length === 0) continue
    const keys = Object.keys(records[0])
    const leadish = keys.filter((k) => LEAD_KEY.test(k.split('.').pop() || '')).length
    if (leadish === 0) continue
    const score = leadish * 1000 + records.length
    if (score >= bestScore) {
      best = records
      bestScore = score
    }
  }
  return best
}

export async function listN8nScripts(connector: Connector): Promise<N8nScript[]> {
  const s = await session(connector)
  const tools = await mcpListTools(s)
  const names = new Set(tools.map((t) => t.name))

  if (names.has('search_workflows') && names.has('execute_workflow')) {
    const result = await mcpCallTool(s, 'search_workflows', {})
    const workflows = resultValues(result)
      .flatMap((v) => objectArrays(v))
      .flat()
      .filter((w): w is { id: unknown; name: unknown; description?: unknown } =>
        Boolean(w && typeof w === 'object' && 'id' in w && 'name' in w),
      )
    const seen = new Set<string>()
    return workflows.flatMap((w) => {
      const id = String(w.id)
      if (seen.has(id)) return []
      seen.add(id)
      return [{
        id: `wf:${id}`,
        name: String(w.name),
        description: typeof w.description === 'string' && w.description ? w.description : null,
        inputs: [],
      }]
    })
  }

  return tools.map((tool) => {
    const schema = tool.inputSchema as { required?: unknown; properties?: Record<string, unknown> } | undefined
    const required = Array.isArray(schema?.required) ? schema.required.filter((r): r is string => typeof r === 'string') : []
    return { id: `tool:${tool.name}`, name: tool.name, description: tool.description || null, inputs: required.slice(0, 5) }
  })
}

/** Runs a script and returns its leads as flat records (keys like `lead.email`). */
export async function runN8nScript(
  connector: Connector,
  scriptId: string,
  inputs: Record<string, string>,
): Promise<Record<string, string>[]> {
  const s = await session(connector)
  let result: unknown
  if (scriptId.startsWith('wf:')) {
    result = await mcpCallTool(s, 'execute_workflow', { workflowId: scriptId.slice(3) })
  } else if (scriptId.startsWith('tool:')) {
    result = await mcpCallTool(s, scriptId.slice(5), inputs)
  } else {
    throw new Error('Pick a script first.')
  }
  const r = result as { isError?: boolean; content?: Array<{ text?: string }> } | null
  if (r?.isError) {
    const message = r.content?.map((c) => c.text).filter(Boolean).join(' ').slice(0, 200)
    throw new Error(message ? `n8n said: ${message}` : 'The script failed in n8n.')
  }
  return bestLeadRecords(resultValues(result))
}
