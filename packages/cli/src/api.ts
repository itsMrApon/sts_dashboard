import { hostname } from 'node:os'
import { VERSION } from './version.js'

export type Client = 'claude' | 'codex' | 'cursor'

const HEADERS = { 'Content-Type': 'application/json', 'User-Agent': `sts-ai-cli/${VERSION}` }
const TIMEOUT_MS = 20_000

async function post<T>(url: string, body: unknown, token?: string): Promise<{ status: number; data: T | null }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: token ? { ...HEADERS, Authorization: `Bearer ${token}`, Accept: 'application/json, text/event-stream' } : HEADERS,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const text = await res.text()
  let data: T | null = null
  try {
    data = text ? (JSON.parse(text) as T) : null
  } catch {
    data = null
  }
  return { status: res.status, data }
}

export type LoginStart = {
  deviceCode: string
  userCode: string
  verificationUrl: string
  interval: number
  expiresAt: string
  mcpUrl: string
}

export async function startLogin(baseUrl: string, client: Client): Promise<LoginStart> {
  const { status, data } = await post<LoginStart & { error?: string }>(`${baseUrl}/api/cli/login/start`, {
    client,
    deviceName: hostname().replace(/\.local$/, '').slice(0, 100),
  })
  if (status !== 200 || !data?.deviceCode) throw new Error(data?.error || `sts-ai answered ${status}. Is ${baseUrl} right?`)
  return data
}

export type PollResult =
  | { status: 'pending' | 'slow_down' | 'denied' | 'expired' | 'invalid' }
  | { status: 'approved'; token: string; userName: string | null; businessName: string | null }

export async function pollLogin(baseUrl: string, deviceCode: string): Promise<PollResult> {
  const { data } = await post<PollResult>(`${baseUrl}/api/cli/login/poll`, { deviceCode })
  return data ?? { status: 'pending' }
}

export async function revokeToken(baseUrl: string, token: string): Promise<boolean> {
  const { status } = await post(`${baseUrl}/api/cli/logout`, {}, token)
  return status === 200
}

type RpcReply = { result?: { content?: { type: string; text?: string }[]; isError?: boolean }; error?: { message: string } }

/**
 * Checks the token against the MCP endpoint and returns the business brain's first lines.
 * null = the token was refused (revoked or wrong server).
 */
export async function readBrainHeadline(mcpUrl: string, token: string): Promise<string | null> {
  const init = await post<RpcReply>(
    mcpUrl,
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'sts-ai-cli', version: VERSION } },
    },
    token,
  )
  if (init.status === 401) return null
  if (init.status !== 200) throw new Error(`The MCP server answered ${init.status}.`)
  const call = await post<RpcReply>(mcpUrl, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_business_brain', arguments: {} } }, token)
  if (call.status === 401) return null
  const text = call.data?.result?.content?.find((c) => c.type === 'text')?.text ?? ''
  if (call.data?.result?.isError) return `(${text})`
  return text.split('\n')[0]?.replace(/^#\s*/, '') || '(business brain is empty)'
}
