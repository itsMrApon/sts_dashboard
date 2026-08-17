export const INBOUND_CONNECTOR_KINDS = [
  'medusa',
  'erpnext',
  'n8n',
  'chatwoot',
  'firecrawl',
  'custom',
] as const

export type InboundConnectorKind = (typeof INBOUND_CONNECTOR_KINDS)[number]

export type InboundConnectorInput = {
  tenantId?: string
  workspaceId?: string
  kind: string
  label: string
  mcpUrl: string
  authType?: string
  authSecret?: string
  enabled?: boolean
}
