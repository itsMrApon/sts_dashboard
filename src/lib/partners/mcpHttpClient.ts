type JsonRpcRequest = {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params?: Record<string, unknown>
}

type JsonRpcResponse = {
  jsonrpc?: '2.0'
  id?: number | string | null
  result?: unknown
  error?: { code?: number; message?: string; data?: unknown }
}

export type McpToolDescriptor = {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export type McpSession = {
  endpoint: string
  transport: 'mcp-http' | 'mcp-sse'
  sessionId?: string
  authHeader?: string
}

function authHeaders(authSecret?: string | null, authType?: string): Record<string, string> {
  const secret = authSecret?.trim()
  if (!secret) return {}
  if (authType === 'basic') return { Authorization: `Basic ${secret}` }
  if (authType === 'token' || authType === 'api_key') return { Authorization: `Token ${secret}` }
  return { Authorization: `Bearer ${secret}` }
}

async function postJsonRpc(
  url: string,
  body: JsonRpcRequest,
  headers: Record<string, string>,
  sessionId?: string,
): Promise<{ response: JsonRpcResponse; sessionId?: string }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-03-26',
      ...headers,
      ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  })

  const nextSession = res.headers.get('mcp-session-id') ?? sessionId
  const contentType = res.headers.get('content-type') || ''

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`MCP HTTP ${res.status}: ${text.slice(0, 200) || res.statusText}`)
  }

  if (contentType.includes('text/event-stream')) {
    const text = await res.text()
    const dataLine = text
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith('data:'))
    if (!dataLine) throw new Error('MCP SSE response missing data')
    const payload = dataLine.replace(/^data:\s*/, '')
    return { response: JSON.parse(payload) as JsonRpcResponse, sessionId: nextSession }
  }

  return { response: (await res.json()) as JsonRpcResponse, sessionId: nextSession }
}

async function trySseEndpoint(
  baseUrl: string,
  headers: Record<string, string>,
): Promise<string | null> {
  const candidates = [
    baseUrl.replace(/\/$/, ''),
    `${baseUrl.replace(/\/$/, '')}/sse`,
    baseUrl.includes('/mcp') ? baseUrl.replace(/\/mcp\/?$/, '/sse') : `${baseUrl.replace(/\/$/, '')}/sse`,
  ]

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          ...headers,
        },
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok || !res.body) continue
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      const deadline = Date.now() + 4000
      while (Date.now() < deadline) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const match = buffer.match(/event:\s*endpoint\s*\ndata:\s*(.+)/i)
        if (match?.[1]) {
          const endpointPath = match[1].trim()
          await reader.cancel().catch(() => undefined)
          if (endpointPath.startsWith('http')) return endpointPath
          const origin = new URL(url).origin
          return `${origin}${endpointPath.startsWith('/') ? '' : '/'}${endpointPath}`
        }
      }
      await reader.cancel().catch(() => undefined)
    } catch {
      // try next candidate
    }
  }
  return null
}

export async function openMcpSession(options: {
  mcpUrl: string
  authSecret?: string | null
  authType?: string
}): Promise<McpSession | null> {
  const headers = authHeaders(options.authSecret, options.authType)
  const endpoint = options.mcpUrl.trim()
  if (!endpoint) return null

  const initReq: JsonRpcRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'sts-ai-partners', version: '1.0.0' },
    },
  }

  try {
    const { response, sessionId } = await postJsonRpc(endpoint, initReq, headers)
    if (response.error) throw new Error(response.error.message || 'initialize failed')
    // notifications/initialized is best-effort
    void postJsonRpc(
      endpoint,
      { jsonrpc: '2.0', id: 2, method: 'notifications/initialized', params: {} },
      headers,
      sessionId,
    ).catch(() => undefined)
    return { endpoint, transport: 'mcp-http', sessionId, authHeader: headers.Authorization }
  } catch {
    const sseMessageUrl = await trySseEndpoint(endpoint, headers)
    if (!sseMessageUrl) return null
    try {
      const { response, sessionId } = await postJsonRpc(sseMessageUrl, initReq, headers)
      if (response.error) throw new Error(response.error.message || 'SSE initialize failed')
      return {
        endpoint: sseMessageUrl,
        transport: 'mcp-sse',
        sessionId,
        authHeader: headers.Authorization,
      }
    } catch {
      return null
    }
  }
}

export async function mcpListTools(session: McpSession): Promise<McpToolDescriptor[]> {
  const headers: Record<string, string> = session.authHeader
    ? { Authorization: session.authHeader }
    : {}
  const { response } = await postJsonRpc(
    session.endpoint,
    { jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} },
    headers,
    session.sessionId,
  )
  if (response.error) throw new Error(response.error.message || 'tools/list failed')
  const result = response.result as { tools?: McpToolDescriptor[] } | undefined
  return Array.isArray(result?.tools) ? result.tools : []
}

export async function mcpCallTool(
  session: McpSession,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const headers: Record<string, string> = session.authHeader
    ? { Authorization: session.authHeader }
    : {}
  const { response } = await postJsonRpc(
    session.endpoint,
    {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name, arguments: args },
    },
    headers,
    session.sessionId,
  )
  if (response.error) throw new Error(response.error.message || 'tools/call failed')
  return response.result
}
