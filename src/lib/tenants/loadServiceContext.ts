import { loadMcpContextForTenant } from '@/lib/tenants/loadMcpContext'
import {
  getServiceDefinition,
  isCustomConnectorId,
  isTenantServiceId,
  normalizePartnerKind,
  tenantResourcesForServices,
  type CustomMcpConnector,
  type TenantServiceId,
} from '@/lib/tenants/tenantServices'
import type { PartnerConnectionStatus } from '@/lib/partners/types'

async function loadExternalMcpContext(
  provider: string,
  tenantId: string,
  endpoint: string | undefined,
  demo: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!endpoint) {
    return { provider, status: 'demo', tenantId, ...demo }
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'sts-ai', version: '1.0.0' },
          tenantId,
        },
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      return { provider, status: 'error', message: `${provider} MCP HTTP ${res.status}` }
    }
    return { provider, status: 'live', data: await res.json() }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { provider, status: 'error', message }
  }
}

export async function loadServiceContext(
  tenantId: string,
  serviceIds: string[],
  customConnectors: CustomMcpConnector[] = [],
  partnerStatuses: PartnerConnectionStatus[] = [],
): Promise<Record<string, unknown>> {
  const context: Record<string, unknown> = {}
  const builtIn = serviceIds.filter(isTenantServiceId)

  const tenantPaths = tenantResourcesForServices(builtIn)
  if (tenantPaths.length > 0) {
    context.tenantMcp = await loadMcpContextForTenant(tenantId, tenantPaths)
  }

  const statusByKind = new Map(
    partnerStatuses.map((s) => [normalizePartnerKind(s.kind), s] as const),
  )

  for (const id of builtIn) {
    const service = getServiceDefinition(id as TenantServiceId)
    const kind = normalizePartnerKind(service.id)

    if (service.mcpKind === 'medusa' || service.id === 'erpnext' || service.mcpKind === 'n8n' || service.id === 'chatwoot') {
      const key =
        kind === 'medusa'
          ? 'medusaMcp'
          : kind === 'erpnext'
            ? 'erpnextMcp'
            : kind === 'n8n'
              ? 'n8nMcp'
              : 'chatwootMcp'
      const status = statusByKind.get(kind)
      context[key] = status
        ? {
            provider: kind,
            status: status.status,
            transport: status.transport,
            toolCount: status.toolCount,
            mcpUrl: status.mcpUrl,
            message: status.message,
            note:
              'Write actions require user confirmation in chat before execution. Reads run automatically.',
          }
        : {
            provider: kind,
            status: 'error',
            message: `Connect ${kind} on /tenants/partners?kind=${kind} for this workspace.`,
          }
      continue
    }

    if (service.mcpKind === 'nextjs') {
      context.nextjsMcp = await loadExternalMcpContext(
        'nextjs',
        tenantId,
        process.env.NEXTJS_MCP_URL?.trim(),
        {
          note: 'Connect NEXTJS_MCP_URL for live site MCP.',
          routes: [
            { path: '/api/mcp/handshake', method: 'POST' },
            { path: '/api/mcp/jsonrpc', method: 'POST' },
          ],
        },
      )
    }
    if (service.mcpKind === 'firecrawl') {
      const status = statusByKind.get('firecrawl')
      context.firecrawlMcp = status
        ? {
            provider: 'firecrawl',
            status: status.status,
            transport: status.transport,
            toolCount: status.toolCount,
            mcpUrl: status.mcpUrl,
            message: status.message,
          }
        : await loadExternalMcpContext(
            'firecrawl',
            tenantId,
            process.env.FIRECRAWL_MCP_URL?.trim(),
            { note: 'Connect FIRECRAWL_MCP_URL or add a Firecrawl partner connector.' },
          )
    }
  }

  for (const id of serviceIds.filter(isCustomConnectorId)) {
    const connector = customConnectors.find((c) => c.id === id)
    const status = partnerStatuses.find((s) => s.connectorId && id.includes(s.connectorId))
    context[id] = status
      ? {
          provider: connector?.label ?? id,
          status: status.status,
          transport: status.transport,
          toolCount: status.toolCount,
          mcpUrl: status.mcpUrl,
          message: status.message,
        }
      : connector?.mcpUrl
        ? await loadExternalMcpContext(connector.label, tenantId, connector.mcpUrl, {
            note: 'Custom MCP connector',
          })
        : {
            provider: connector?.label ?? id,
            status: 'pending',
            note: 'MCP server URL not configured yet.',
          }
  }

  if (partnerStatuses.length > 0) {
    context.partnerConnections = partnerStatuses
  }

  return context
}
