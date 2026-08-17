export type TenantServiceId =
  | 'business-profile'
  | 'medusa'
  | 'erpnext'
  | 'nextjs'
  | 'blog'
  | 'mcp'
  | 'messages'
  | 'n8n'
  | 'firecrawl'
  | 'chatwoot'

export type McpKind = 'tenant' | 'medusa' | 'nextjs' | 'n8n' | 'firecrawl' | 'external'

/** Canonical partner kind. Aliases and legacy Saleor rows all map to Medusa. */
export function normalizePartnerKind(kind: string): string {
  const raw = kind.trim().toLowerCase()
  if (raw.startsWith('custom:')) return raw
  if (raw === 'saleor' || raw === 'madusa' || raw === 'ecommerce' || raw === 'ecom') {
    return 'medusa'
  }
  if (raw === 'automate' || raw === 'workflow') return 'n8n'
  if (raw === 'erp' || raw === 'ury') return 'erpnext'
  if (raw === 'inbox') return 'chatwoot'
  return raw
}

export const CUSTOM_CONNECTOR_PREFIX = 'custom:'

export type CustomMcpConnector = {
  id: string
  label: string
  mcpUrl?: string
}

export type TenantServiceDefinition = {
  id: TenantServiceId
  label: string
  description: string
  mcpKind: McpKind
  tenantResources?: string[]
}

export const TENANT_SERVICE_CATALOG: TenantServiceDefinition[] = [
  {
    id: 'business-profile',
    label: 'Publish profile',
    description: 'Published workspace context for websites and embed',
    mcpKind: 'tenant',
    tenantResources: ['core/compact', 'industry/compact'],
  },
  {
    id: 'medusa',
    label: 'Medusa.js',
    description: 'Commerce catalog, orders, and sales via Medusa Admin/MCP',
    mcpKind: 'medusa',
  },
  {
    id: 'erpnext',
    label: 'ERPNext',
    description: 'ERP documents, inventory, POS, and accounting via ERPNext',
    mcpKind: 'external',
  },
  {
    id: 'n8n',
    label: 'n8n',
    description: 'Workflow automation and inbound/outbound triggers via n8n MCP',
    mcpKind: 'n8n',
  },
  {
    id: 'firecrawl',
    label: 'Firecrawl',
    description: 'Web crawl and content extraction via Firecrawl MCP',
    mcpKind: 'firecrawl',
  },
  {
    id: 'chatwoot',
    label: 'Chatwoot',
    description:
      'Omnichannel inbox (WhatsApp, email, web chat, social) via Chatwoot REST API',
    mcpKind: 'external',
  },
  {
    id: 'nextjs',
    label: 'Next.js',
    description: 'Next.js site routes and embed MCP handshake',
    mcpKind: 'nextjs',
  },
  {
    id: 'blog',
    label: 'Blog',
    description: 'Industry copy blocks for blog sections',
    mcpKind: 'tenant',
    tenantResources: ['industry/compact'],
  },
  {
    id: 'mcp',
    label: 'MCP',
    description: 'Tenant MCP resources (core, services, links)',
    mcpKind: 'tenant',
    tenantResources: ['core/compact', 'services/list', 'links', 'pricing'],
  },
  {
    id: 'messages',
    label: 'Messages',
    description: 'Inbound room links and routing metadata',
    mcpKind: 'tenant',
    tenantResources: ['links'],
  },
]

/** Inbound MCP connectors shown in the tenant chat multi-select. */
export const INBOUND_CONNECTOR_IDS: TenantServiceId[] = [
  'medusa',
  'erpnext',
  'n8n',
  'firecrawl',
  'chatwoot',
]

const INBOUND_CONNECTOR_ID_SET = new Set<string>(INBOUND_CONNECTOR_IDS)

export function isInboundConnectorId(value: string): value is TenantServiceId {
  return INBOUND_CONNECTOR_ID_SET.has(value)
}

const SERVICE_IDS = new Set(TENANT_SERVICE_CATALOG.map((s) => s.id))

export function isTenantServiceId(value: string): value is TenantServiceId {
  return SERVICE_IDS.has(value as TenantServiceId)
}

export function isCustomConnectorId(value: string): boolean {
  return value.startsWith(CUSTOM_CONNECTOR_PREFIX)
}

export function isConnectorId(value: string): boolean {
  return isTenantServiceId(value) || isCustomConnectorId(value)
}

export function getConnectorLabel(
  id: string,
  customConnectors: CustomMcpConnector[] = [],
): string {
  if (isCustomConnectorId(id)) {
    return customConnectors.find((c) => c.id === id)?.label ?? id.slice(CUSTOM_CONNECTOR_PREFIX.length)
  }
  if (isTenantServiceId(id)) return getServiceDefinition(id).label
  return id
}

export function createCustomConnectorId(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${CUSTOM_CONNECTOR_PREFIX}${slug || 'connector'}-${crypto.randomUUID().slice(0, 8)}`
}

export function getServiceDefinition(id: TenantServiceId): TenantServiceDefinition {
  const service = TENANT_SERVICE_CATALOG.find((s) => s.id === id)
  if (!service) throw new Error(`Unknown service: ${id}`)
  return service
}

export function tenantResourcesForServices(serviceIds: string[]): string[] {
  const paths = new Set<string>()
  for (const id of serviceIds) {
    if (!isTenantServiceId(id)) continue
    const service = getServiceDefinition(id)
    for (const path of service.tenantResources ?? []) paths.add(path)
  }
  return [...paths]
}

function hasPartner(serviceIds: string[], kind: string): boolean {
  return serviceIds.some((id) => normalizePartnerKind(id) === kind)
}

export function promptSuggestionsForServices(serviceIds: string[]): string[] {
  const suggestions: string[] = []
  if (hasPartner(serviceIds, 'erpnext')) {
    suggestions.push('What inventory or invoices are open in ERPNext?')
    suggestions.push('Print a POS invoice for 1 cup of coffee.')
  }
  if (hasPartner(serviceIds, 'medusa')) {
    suggestions.push("Generate today's Medusa sales sheet.")
    suggestions.push('Check Medusa stock that is low today.')
  }
  if (hasPartner(serviceIds, 'n8n')) {
    suggestions.push('Start my n8n workflow by name.')
    suggestions.push('Where is the latest n8n output file stored?')
  }
  if (hasPartner(serviceIds, 'firecrawl')) {
    suggestions.push('Crawl the latest site pages for this tenant context.')
  }
  if (hasPartner(serviceIds, 'chatwoot')) {
    suggestions.push('Any new messages in Chatwoot?')
    suggestions.push('Show WhatsApp new messages.')
  }
  if (serviceIds.includes('business-profile')) {
    suggestions.push('Summarize publishable profile for this workspace.')
  }
  if (serviceIds.includes('nextjs')) {
    suggestions.push('Which Next.js pages should call tenant MCP handshake?')
  }
  if (serviceIds.includes('blog')) {
    suggestions.push('Draft a blog intro from tenant industry context.')
  }
  if (serviceIds.includes('mcp')) {
    suggestions.push('Which MCP scopes does this tenant expose?')
  }
  if (serviceIds.includes('messages')) {
    suggestions.push('What is the inbound chat room for this tenant?')
  }
  return suggestions.length > 0
    ? suggestions.slice(0, 3)
    : ['What can I do with the selected services for this tenant?']
}
