import jwt from 'jsonwebtoken'

type McpScope =
  | 'tenant.core.compact.read'
  | 'tenant.industry.compact.read'
  | 'tenant.social.compact.read'
  | 'tenant.services.list.read'
  | 'tenant.pricing.read'
  | 'tenant.links.read'
  | 'tenant.room.merged.read'

export type McpHandshakePayload = {
  tenantId: string
  publishProfileId: string | null
  domain: string
  scopes: McpScope[]
  exp: number
}

const getSecret = () => process.env.MCP_SHARED_SECRET || process.env.NEXTAUTH_SECRET || 'dev-mcp-secret'

export const signMcpToken = (payload: McpHandshakePayload) => {
  return jwt.sign(payload, getSecret(), {
    algorithm: 'HS256',
    issuer: 'sts-ai-mcp',
    audience: 'sts-ai-external-app',
  })
}

export const verifyMcpToken = (token: string): McpHandshakePayload | null => {
  try {
    const payload = jwt.verify(token, getSecret(), {
      algorithms: ['HS256'],
      issuer: 'sts-ai-mcp',
      audience: 'sts-ai-external-app',
    }) as McpHandshakePayload
    if (!payload.exp || Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

