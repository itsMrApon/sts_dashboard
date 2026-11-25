import { NextRequest, NextResponse } from 'next/server'
import { readJsonObject, withRouteErrors } from '@/lib/http/routeErrors'
import { checkRateLimit } from '@/lib/embed/rateLimit'
import { clientIp } from '@/lib/embed/clientIp'
import { CLI_POLL_INTERVAL_SEC, isCliClient, startCliLogin } from '@/lib/cli/cliAuth'

/**
 * POST /api/cli/login/start — the CLI asks to log in. Public (the CLI has no session yet);
 * rate limited per IP. Returns the secret device code (kept by the CLI) and the page to open.
 */
export const POST = withRouteErrors('api/cli/login/start', async function POST(request: NextRequest) {
  const limit = await checkRateLimit(`cli-start:${clientIp(request.headers)}`, 10, 10 * 60 * 1000)
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many logins. Try again in a few minutes.' }, { status: 429 })
  }
  const body = await readJsonObject<{ client: string; deviceName: string }>(request)
  if (!isCliClient(body?.client)) {
    return NextResponse.json({ error: 'client must be claude, codex or cursor' }, { status: 400 })
  }
  const deviceName = typeof body?.deviceName === 'string' ? body.deviceName.replace(/[^\p{L}\p{N} ._'-]/gu, '').trim() : null

  const login = await startCliLogin({ client: body.client, deviceName: deviceName || null })
  const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  const verificationUrl = `${origin}/cli/authorize?code=${encodeURIComponent(login.userCode)}`
  return NextResponse.json({
    deviceCode: login.deviceCode,
    userCode: login.userCode,
    verificationUrl,
    interval: CLI_POLL_INTERVAL_SEC,
    expiresAt: login.expiresAt.toISOString(),
    mcpUrl: `${origin}/api/mcp/agent`,
  })
})
