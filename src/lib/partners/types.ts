export type PartnerToolSideEffect = 'read' | 'write'

export type PartnerToolDefinition = {
  name: string
  description: string
  sideEffect: PartnerToolSideEffect
  /** JSON Schema object for Gemini function parameters */
  parameters: Record<string, unknown>
  connectorId: string
  connectorKind: string
  connectorLabel: string
}

export type PartnerConnectorRuntime = {
  id: string
  workspaceId: string
  kind: string
  label: string
  mcpUrl: string
  authType: string
  authSecret: string | null
  enabled: boolean
}

export type PartnerToolCall = {
  name: string
  args: Record<string, unknown>
  connectorId: string
}

export type PartnerToolResult = {
  ok: boolean
  name: string
  connectorId: string
  connectorKind: string
  data?: unknown
  error?: string
}

export type PendingProposalTool = {
  name: string
  args: Record<string, unknown>
  connectorId: string
  connectorKind: string
  connectorLabel: string
  description: string
}

export type PendingProposal = {
  id: string
  sessionId: string
  workspaceId: string
  userId: string
  summary: string
  tools: PendingProposalTool[]
  createdAt: number
  expiresAt: number
}

export type PartnerConnectionStatus = {
  kind: string
  label: string
  connectorId: string
  mcpUrl: string
  status: 'live' | 'adapter' | 'error' | 'disabled'
  transport?: 'mcp-http' | 'mcp-sse' | 'rest-adapter'
  toolCount: number
  message?: string
}
