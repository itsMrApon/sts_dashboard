import { NextRequest, NextResponse } from 'next/server'
import { readJsonObject, withRouteErrors } from '@/lib/http/routeErrors'
import { checkRateLimit } from '@/lib/embed/rateLimit'
import { clientIp } from '@/lib/embed/clientIp'
import { pollCliLogin, sha256 } from '@/lib/cli/cliAuth'

/**
 * POST /api/cli/login/poll — the CLI waits for the creator to approve. Returns
 * { status: pending | approved | denied | expired | invalid }; approved carries the token, once.
 */
export const POST = withRouteErrors('api/cli/login/poll', async function POST(request: NextRequest) {
  const body = await readJsonObject<{ deviceCode: string }>(request)
  const deviceCode = typeof body?.deviceCode === 'string' ? body.deviceCode : ''
  if (deviceCode.length < 20 || deviceCode.length > 100) {
    return NextResponse.json({ status: 'invalid' }, { status: 400 })
  }
  // One poll every 2 s is expected; allow some slack, per device and per IP.
  const [perDevice, perIp] = await Promise.all([
    checkRateLimit(`cli-poll:${sha256(deviceCode).slice(0, 32)}`, 60, 60 * 1000),
    checkRateLimit(`cli-poll-ip:${clientIp(request.headers)}`, 240, 60 * 1000),
  ])
  if (!perDevice.ok || !perIp.ok) {
    return NextResponse.json({ status: 'slow_down' }, { status: 429 })
  }
  const result = await pollCliLogin(deviceCode)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
})
