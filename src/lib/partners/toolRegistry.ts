import { prismaClient } from '@/lib/prismaClient'
import { normalizePartnerKind } from '@/lib/tenants/tenantServices'
import {
  medusaAdapterTools,
  probeMedusaAdapter,
  runMedusaAdapterTool,
} from './adapters/medusa'
import {
  erpnextAdapterTools,
  probeErpnextAdapter,
  runErpnextAdapterTool,
} from './adapters/erpnext'
import { n8nAdapterTools, probeN8nAdapter, runN8nAdapterTool } from './adapters/n8n'
import {
  chatwootAdapterTools,
  probeChatwootAdapter,
  runChatwootAdapterTool,
} from './adapters/chatwoot'
import { mcpCallTool, mcpListTools, openMcpSession, type McpSession } from './mcpHttpClient'
import type {
  PartnerConnectionStatus,
  PartnerConnectorRuntime,
  PartnerToolDefinition,
  PartnerToolResult,
  PartnerToolSideEffect,
} from './types'

const REST_ADAPTER_KINDS = new Set(['medusa', 'erpnext', 'n8n', 'chatwoot'])
const BUILTIN_PARTNER_KINDS = ['medusa', 'erpnext', 'n8n', 'firecrawl', 'chatwoot'] as const

const WRITE_NAME_HINT =
  /(create|update|delete|remove|trigger|execute|invoice|print|write|post|submit|cancel|refund|pay|send|reply)/i

function inferSideEffect(name: string, description?: string): PartnerToolSideEffect {
  const hay = `${name} ${description || ''}`
  return WRITE_NAME_HINT.test(hay) ? 'write' : 'read'
}

function selectedKinds(serviceIds: string[]): Set<string> {
  return new Set(serviceIds.map(normalizePartnerKind))
}

export async function loadPartnerConnectorsWithSecrets(
  workspaceId: string,
  userId: string,
): Promise<PartnerConnectorRuntime[]> {
  const rows = await prismaClient.workspacePartnerConnector.findMany({
    where: { workspaceId, userId, enabled: true },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      workspaceId: true,
      kind: true,
      label: true,
      mcpUrl: true,
      authType: true,
      authSecret: true,
      enabled: true,
    },
  })

  return rows.map((row) => ({
    ...row,
    kind: normalizePartnerKind(row.kind),
  }))
}

function adapterToolsFor(connector: PartnerConnectorRuntime): PartnerToolDefinition[] {
  switch (connector.kind) {
    case 'medusa':
      return medusaAdapterTools(connector)
    case 'erpnext':
      return erpnextAdapterTools(connector)
    case 'n8n':
      return n8nAdapterTools(connector)
    case 'chatwoot':
      return chatwootAdapterTools(connector)
    default:
      return []
  }
}

async function probeAdapter(
  connector: PartnerConnectorRuntime,
): Promise<{ ok: boolean; message?: string }> {
  switch (connector.kind) {
    case 'medusa':
      return probeMedusaAdapter(connector)
    case 'erpnext':
      return probeErpnextAdapter(connector)
    case 'n8n':
      return probeN8nAdapter(connector)
    case 'chatwoot':
      return probeChatwootAdapter(connector)
    default:
      return { ok: false, message: 'No REST adapter for this partner kind' }
  }
}

type ResolvedConnector = {
  connector: PartnerConnectorRuntime
  tools: PartnerToolDefinition[]
  status: PartnerConnectionStatus
  mcpSession?: McpSession
}

async function resolveConnector(connector: PartnerConnectorRuntime): Promise<ResolvedConnector> {
  if (!connector.enabled) {
    return {
      connector,
      tools: [],
      status: {
        kind: connector.kind,
        label: connector.label,
        connectorId: connector.id,
        mcpUrl: connector.mcpUrl,
        status: 'disabled',
        toolCount: 0,
      },
    }
  }

  const session = await openMcpSession({
    mcpUrl: connector.mcpUrl,
    authSecret: connector.authSecret,
    authType: connector.authType,
  })

  if (session) {
    try {
      const mcpTools = await mcpListTools(session)
      const mappedMcp: PartnerToolDefinition[] = mcpTools.map((t) => ({
        name: t.name,
        description: t.description || t.name,
        sideEffect: inferSideEffect(t.name, t.description),
        parameters: t.inputSchema || { type: 'object', properties: {} },
        connectorId: connector.id,
        connectorKind: connector.kind,
        connectorLabel: connector.label,
      }))
      const adapter = adapterToolsFor(connector)
      const adapterNames = new Set(adapter.map((tool) => tool.name))
      const tools = [...adapter, ...mappedMcp.filter((tool) => !adapterNames.has(tool.name))]
      return {
        connector,
        tools,
        mcpSession: session,
        status: {
          kind: connector.kind,
          label: connector.label,
          connectorId: connector.id,
          mcpUrl: connector.mcpUrl,
          status: tools.length > 0 ? 'live' : 'error',
          transport: adapter.length > 0 ? 'rest-adapter' : session.transport,
          toolCount: tools.length,
          message:
            adapter.length > 0
              ? 'MCP plus REST adapter tools'
              : undefined,
        },
      }
    } catch (err) {
      void err
    }
  }

  const tools = adapterToolsFor(connector)
  if (tools.length === 0) {
    return {
      connector,
      tools: [],
      status: {
        kind: connector.kind,
        label: connector.label,
        connectorId: connector.id,
        mcpUrl: connector.mcpUrl,
        status: 'error',
        toolCount: 0,
        message: 'No MCP tools and no REST adapter available',
      },
    }
  }

  const probe = await probeAdapter(connector)
  return {
    connector,
    tools,
    status: {
      kind: connector.kind,
      label: connector.label,
      connectorId: connector.id,
      mcpUrl: connector.mcpUrl,
      status: probe.ok ? 'adapter' : 'error',
      transport: 'rest-adapter',
      toolCount: tools.length,
      message: probe.ok ? 'Using REST adapter' : probe.message,
    },
  }
}

export type PartnerToolBundle = {
  tools: PartnerToolDefinition[]
  statuses: PartnerConnectionStatus[]
  byToolName: Map<string, ResolvedConnector>
}

export async function buildPartnerToolBundle(
  workspaceId: string,
  userId: string,
  serviceIds: string[],
): Promise<PartnerToolBundle> {
  const kinds = selectedKinds(serviceIds)
  const connectors = await loadPartnerConnectorsWithSecrets(workspaceId, userId)

  // One enabled connector per partner kind per account.
  const selected: PartnerConnectorRuntime[] = []
  const seenIds = new Set<string>()
  for (const kind of kinds) {
    if (kind.startsWith('custom:')) continue
    const match = connectors.find((c) => c.kind === kind)
    if (match && !seenIds.has(match.id)) {
      seenIds.add(match.id)
      selected.push(match)
    }
  }

  const customSelected = serviceIds.filter((id) => id.startsWith('custom:'))
  const withCustom = [
    ...selected,
    ...connectors.filter(
      (c) =>
        c.kind === 'custom' &&
        customSelected.some((id) => id.includes(c.id) || id.endsWith(c.label.toLowerCase())),
    ),
  ]

  const unique = [...new Map(withCustom.map((c) => [c.id, c])).values()]

  // If user selected a built-in kind with no connector row, surface empty status
  const resolved = await Promise.all(unique.map((c) => resolveConnector(c)))
  const statuses = [...resolved.map((r) => r.status)]

  for (const kind of kinds) {
    if (kind.startsWith('custom:')) continue
    if (!(BUILTIN_PARTNER_KINDS as readonly string[]).includes(kind)) continue
    if (!statuses.some((s) => s.kind === kind)) {
      statuses.push({
        kind,
        label: kind,
        connectorId: '',
        mcpUrl: '',
        status: 'error',
        toolCount: 0,
        message: `No enabled ${kind} connector on Partners page`,
      })
    }
  }

  const tools: PartnerToolDefinition[] = []
  const byToolName = new Map<string, ResolvedConnector>()

  for (const entry of resolved) {
    for (const tool of entry.tools) {
      // Prefix tool names with kind to avoid collisions across partners
      const scopedName =
        tool.name.startsWith(`${entry.connector.kind}_`) || tool.name.includes('__')
          ? tool.name
          : `${entry.connector.kind}__${tool.name}`
      const scoped = { ...tool, name: scopedName }
      tools.push(scoped)
      byToolName.set(scopedName, entry)
      // Also allow unprefixed names when unique
      if (!byToolName.has(tool.name)) byToolName.set(tool.name, entry)
    }
  }

  return { tools, statuses, byToolName }
}

function stripKindPrefix(name: string, kind: string): string {
  const prefix = `${kind}__`
  return name.startsWith(prefix) ? name.slice(prefix.length) : name
}

export async function executePartnerTool(options: {
  bundle: PartnerToolBundle
  name: string
  args: Record<string, unknown>
}): Promise<PartnerToolResult> {
  const entry = options.bundle.byToolName.get(options.name)
  if (!entry) {
    return {
      ok: false,
      name: options.name,
      connectorId: '',
      connectorKind: 'unknown',
      error: `Unknown partner tool: ${options.name}`,
    }
  }

  const rawName = stripKindPrefix(options.name, entry.connector.kind)
  const isAdapterNamed =
    REST_ADAPTER_KINDS.has(entry.connector.kind) &&
    (rawName.startsWith(`${entry.connector.kind}_`) ||
      options.name.startsWith(`${entry.connector.kind}_`))

  if (entry.mcpSession && !isAdapterNamed) {
    try {
      const data = await mcpCallTool(entry.mcpSession, rawName, options.args)
      return {
        ok: true,
        name: options.name,
        connectorId: entry.connector.id,
        connectorKind: entry.connector.kind,
        data,
      }
    } catch (err) {
      // Fall through to adapter for known kinds
      const message = err instanceof Error ? err.message : String(err)
      if (!REST_ADAPTER_KINDS.has(entry.connector.kind)) {
        return {
          ok: false,
          name: options.name,
          connectorId: entry.connector.id,
          connectorKind: entry.connector.kind,
          error: message,
        }
      }
    }
  }

  switch (entry.connector.kind) {
    case 'medusa':
      return runMedusaAdapterTool(entry.connector, rawName, options.args)
    case 'erpnext':
      return runErpnextAdapterTool(entry.connector, rawName, options.args)
    case 'n8n':
      return runN8nAdapterTool(entry.connector, rawName, options.args)
    case 'chatwoot':
      return runChatwootAdapterTool(entry.connector, rawName, options.args)
    default:
      return {
        ok: false,
        name: options.name,
        connectorId: entry.connector.id,
        connectorKind: entry.connector.kind,
        error: 'No executor for this partner tool',
      }
  }
}

export function findToolDefinition(
  bundle: PartnerToolBundle,
  name: string,
): PartnerToolDefinition | undefined {
  return bundle.tools.find((t) => t.name === name)
}
