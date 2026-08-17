import type { PartnerConnectorRuntime, PartnerToolDefinition, PartnerToolResult } from '../types'

function baseUrl(connector: PartnerConnectorRuntime): string {
  return connector.mcpUrl
    .replace(/\/mcp\/?$/, '')
    .replace(/\/sse\/?$/, '')
    .replace(/\/$/, '')
}

function authHeaders(connector: PartnerConnectorRuntime): Record<string, string> {
  const secret = connector.authSecret?.trim() || process.env.N8N_API_KEY?.trim() || ''
  if (!secret) return {}
  return { 'X-N8N-API-KEY': secret }
}

async function n8nFetch(
  connector: PartnerConnectorRuntime,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const url = `${baseUrl(connector)}${path}`
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders(connector),
      ...(init?.headers as Record<string, string> | undefined),
    },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`n8n HTTP ${res.status}: ${text.slice(0, 200) || res.statusText}`)
  }
  if (res.status === 204) return { ok: true }
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) return res.json()
  const text = await res.text()
  return { ok: true, body: text }
}

type N8nWorkflow = {
  id?: string
  name?: string
  active?: boolean
  updatedAt?: string
  nodes?: Array<{
    type?: string
    name?: string
    parameters?: { path?: string; httpMethod?: string }
  }>
}

function asWorkflowList(data: unknown): N8nWorkflow[] {
  if (Array.isArray(data)) return data as N8nWorkflow[]
  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: N8nWorkflow[] }).data
  }
  return []
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function scoreName(candidate: string, query: string): number {
  const a = normalizeName(candidate)
  const b = normalizeName(query)
  if (!a || !b) return 0
  if (a === b) return 100
  if (a.includes(b) || b.includes(a)) return 80
  const aTokens = new Set(a.split(' '))
  const overlap = b.split(' ').filter((token) => aTokens.has(token)).length
  return overlap * 20
}

async function listWorkflows(
  connector: PartnerConnectorRuntime,
  limit = 50,
): Promise<N8nWorkflow[]> {
  const data = await n8nFetch(connector, `/api/v1/workflows?limit=${limit}`)
  return asWorkflowList(data)
}

async function resolveWorkflow(
  connector: PartnerConnectorRuntime,
  nameOrId?: string,
): Promise<N8nWorkflow> {
  const query = nameOrId?.trim() || ''
  const workflows = await listWorkflows(connector, 100)
  if (workflows.length === 0) throw new Error('No n8n workflows found on this instance')

  if (!query) {
    const active = workflows.find((row) => row.active) || workflows[0]
    if (!active?.id) throw new Error('Could not resolve an n8n workflow')
    return active
  }

  const byId = workflows.find((row) => row.id === query)
  if (byId) return byId

  const ranked = [...workflows].sort(
    (left, right) => scoreName(right.name || '', query) - scoreName(left.name || '', query),
  )
  const best = ranked[0]
  if (!best?.id || scoreName(best.name || '', query) < 20) {
    throw new Error(`No n8n workflow matched "${query}"`)
  }
  return best
}

function webhookFromWorkflow(workflow: N8nWorkflow): { path: string; method: string } | null {
  const node = (workflow.nodes || []).find((item) =>
    String(item.type || '').toLowerCase().includes('webhook'),
  )
  const path = String(node?.parameters?.path || '').replace(/^\/+/, '')
  if (!path) return null
  const method = String(node?.parameters?.httpMethod || 'POST').toUpperCase()
  return { path, method }
}

export function n8nAdapterTools(connector: PartnerConnectorRuntime): PartnerToolDefinition[] {
  const common = {
    connectorId: connector.id,
    connectorKind: 'n8n',
    connectorLabel: connector.label,
  }
  return [
    {
      ...common,
      name: 'n8n_list_workflows',
      description: 'List n8n workflows on the connected instance (name, id, active).',
      sideEffect: 'read',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max workflows (default 50)' },
        },
      },
    },
    {
      ...common,
      name: 'n8n_execute_workflow',
      description:
        'Start an existing n8n workflow by name or id (YouTube reel, project X). Confirm before run.',
      sideEffect: 'write',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Workflow name to fuzzy-match (e.g. x, youtube reel)',
          },
          id: { type: 'string', description: 'Exact workflow id if already known' },
          body: {
            type: 'object',
            description: 'Optional JSON payload sent to the run/webhook',
          },
        },
      },
    },
    {
      ...common,
      name: 'n8n_trigger_webhook',
      description:
        'Trigger an n8n webhook path under /webhook/. Requires confirmation before execution.',
      sideEffect: 'write',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Webhook path after /webhook/ (e.g. lead-ingest)',
          },
          method: {
            type: 'string',
            description: 'HTTP method (default POST)',
          },
          body: {
            type: 'object',
            description: 'JSON body to send',
          },
        },
        required: ['path'],
      },
    },
    {
      ...common,
      name: 'n8n_list_executions',
      description: 'List recent n8n executions, optionally filtered by workflow and status.',
      sideEffect: 'read',
      parameters: {
        type: 'object',
        properties: {
          workflowId: { type: 'string', description: 'Optional workflow id' },
          workflowName: { type: 'string', description: 'Optional workflow name to resolve' },
          status: {
            type: 'string',
            description: 'Optional status: success, error, waiting',
          },
          limit: { type: 'number', description: 'Max rows (default 10)' },
        },
      },
    },
    {
      ...common,
      name: 'n8n_get_execution',
      description:
        'Load one n8n execution including output data (Drive links, file URLs, JSON).',
      sideEffect: 'read',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Execution id' },
        },
        required: ['id'],
      },
    },
  ]
}

export async function runN8nAdapterTool(
  connector: PartnerConnectorRuntime,
  name: string,
  args: Record<string, unknown>,
): Promise<PartnerToolResult> {
  try {
    if (name === 'n8n_list_workflows') {
      const limit = typeof args.limit === 'number' ? args.limit : 50
      const workflows = await listWorkflows(connector, limit)
      return {
        ok: true,
        name,
        connectorId: connector.id,
        connectorKind: 'n8n',
        data: {
          count: workflows.length,
          workflows: workflows.map((row) => ({
            id: row.id,
            name: row.name,
            active: row.active,
            updatedAt: row.updatedAt,
          })),
        },
      }
    }

    if (name === 'n8n_list_executions') {
      const limit = typeof args.limit === 'number' ? args.limit : 10
      let workflowId = typeof args.workflowId === 'string' ? args.workflowId.trim() : ''
      if (!workflowId && typeof args.workflowName === 'string' && args.workflowName.trim()) {
        workflowId = (await resolveWorkflow(connector, args.workflowName)).id || ''
      }
      const qs = new URLSearchParams({ limit: String(limit) })
      if (workflowId) qs.set('workflowId', workflowId)
      if (typeof args.status === 'string' && args.status.trim()) {
        qs.set('status', args.status.trim())
      }
      const data = await n8nFetch(connector, `/api/v1/executions?${qs}`)
      return { ok: true, name, connectorId: connector.id, connectorKind: 'n8n', data }
    }

    if (name === 'n8n_get_execution') {
      const id = String(args.id || '').trim()
      if (!id) throw new Error('Execution id is required')
      const data = await n8nFetch(connector, `/api/v1/executions/${encodeURIComponent(id)}?includeData=true`)
      return { ok: true, name, connectorId: connector.id, connectorKind: 'n8n', data }
    }

    if (name === 'n8n_execute_workflow') {
      const query =
        (typeof args.id === 'string' && args.id.trim()) ||
        (typeof args.name === 'string' && args.name.trim()) ||
        ''
      const workflow = await resolveWorkflow(connector, query || undefined)
      if (!workflow.id) throw new Error('Resolved workflow has no id')
      const payload =
        typeof args.body === 'object' && args.body ? (args.body as Record<string, unknown>) : {}

      try {
        const data = await n8nFetch(connector, `/api/v1/workflows/${encodeURIComponent(workflow.id)}/run`, {
          method: 'POST',
          body: JSON.stringify({ workflowData: payload }),
        })
        return {
          ok: true,
          name,
          connectorId: connector.id,
          connectorKind: 'n8n',
          data: {
            started: true,
            method: 'run',
            workflow: { id: workflow.id, name: workflow.name, active: workflow.active },
            result: data,
          },
        }
      } catch (runError) {
        const raw = (await n8nFetch(
          connector,
          `/api/v1/workflows/${encodeURIComponent(workflow.id)}`,
        )) as N8nWorkflow & { data?: N8nWorkflow }
        const detailed = raw.data || raw
        const webhook = webhookFromWorkflow(detailed)
        if (!webhook) {
          throw runError instanceof Error
            ? runError
            : new Error('Workflow run failed and no webhook path was found')
        }
        const data = await n8nFetch(connector, `/webhook/${webhook.path}`, {
          method: webhook.method,
          body:
            webhook.method === 'GET' || webhook.method === 'HEAD'
              ? undefined
              : JSON.stringify(payload),
        })
        return {
          ok: true,
          name,
          connectorId: connector.id,
          connectorKind: 'n8n',
          data: {
            started: true,
            method: 'webhook',
            webhook: webhook.path,
            workflow: { id: workflow.id, name: workflow.name, active: workflow.active },
            result: data,
            note: 'Public run API was unavailable; triggered the workflow webhook instead.',
          },
        }
      }
    }

    if (name === 'n8n_trigger_webhook') {
      const pathRaw = String(args.path || '').replace(/^\/+/, '')
      if (!pathRaw) throw new Error('Webhook path is required')
      const method = (typeof args.method === 'string' ? args.method : 'POST').toUpperCase()
      const body = typeof args.body === 'object' && args.body ? args.body : {}
      const data = await n8nFetch(connector, `/webhook/${pathRaw}`, {
        method,
        body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(body),
      })
      return { ok: true, name, connectorId: connector.id, connectorKind: 'n8n', data }
    }

    return {
      ok: false,
      name,
      connectorId: connector.id,
      connectorKind: 'n8n',
      error: `Unknown n8n tool: ${name}`,
    }
  } catch (err) {
    return {
      ok: false,
      name,
      connectorId: connector.id,
      connectorKind: 'n8n',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function probeN8nAdapter(
  connector: PartnerConnectorRuntime,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(baseUrl(connector), {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok || res.status === 401 || res.status === 403) return { ok: true }
    return { ok: false, message: `n8n HTTP ${res.status}` }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}
