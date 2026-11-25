import { NextRequest, NextResponse } from 'next/server'
import { withRouteErrors } from '@/lib/http/routeErrors'
import { checkRateLimit } from '@/lib/embed/rateLimit'
import { verifyCliToken } from '@/lib/cli/cliAuth'
import { handleMcpMessage, type JsonRpcResponse } from '@/lib/mcp/agentServer'

export const dynamic = 'force-dynamic'

/**
 * /api/mcp/agent — the MCP endpoint `npx @sts-ai/cli init` points Claude Code, Codex or Cursor
 * at. Streamable HTTP, stateless, JSON replies only. Auth: `Authorization: Bearer sts_…` (a
 * CliToken the creator approved and can revoke in Social).
 */
const unauthorized = () =>
  NextResponse.json(
    { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized. Run npx @sts-ai/cli init again.' } },
    { status: 401, headers: { 'WWW-Authenticate': 'Bearer realm="sts-ai"' } },
  )

export const POST = withRouteErrors('api/mcp/agent', async function POST(request: NextRequest) {
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  const session = token ? await verifyCliToken(token) : null
  if (!session) return unauthorized()

  const limit = await checkRateLimit(`mcp-agent:${session.tokenId}`, 120, 60 * 1000)
  if (!limit.ok) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32029, message: 'Too many requests. Slow down.' } },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 })
  }

  // A batch (2025-03-26 clients) or a single message.
  const messages = Array.isArray(body) ? body : [body]
  if (messages.length === 0 || messages.length > 20) {
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request' } }, { status: 400 })
  }
  const replies: JsonRpcResponse[] = []
  for (const message of messages) {
    const reply = await handleMcpMessage(session.userId, (message ?? {}) as Parameters<typeof handleMcpMessage>[1])
    if (reply) replies.push(reply)
  }
  // Only notifications: accepted, nothing to say.
  if (replies.length === 0) return new NextResponse(null, { status: 202 })
  return NextResponse.json(Array.isArray(body) ? replies : replies[0], { headers: { 'Cache-Control': 'no-store' } })
})

/** No server-to-client stream: this server never sends requests or notifications on its own. */
export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
}

export function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
}
