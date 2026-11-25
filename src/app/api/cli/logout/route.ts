import { NextRequest, NextResponse } from 'next/server'
import { withRouteErrors } from '@/lib/http/routeErrors'
import { revokeCliToken, verifyCliToken } from '@/lib/cli/cliAuth'

/** POST /api/cli/logout — `npx @sts-ai/cli logout` revokes its own token. */
export const POST = withRouteErrors('api/cli/logout', async function POST(request: NextRequest) {
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  const session = token ? await verifyCliToken(token) : null
  if (!session) return NextResponse.json({ error: 'Unknown token' }, { status: 401 })
  await revokeCliToken({ userId: session.userId, tokenId: session.tokenId })
  return NextResponse.json({ ok: true })
})
