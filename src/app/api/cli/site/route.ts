import { NextRequest, NextResponse } from 'next/server'
import { readJsonObject, withRouteErrors } from '@/lib/http/routeErrors'
import { checkRateLimit } from '@/lib/embed/rateLimit'
import { verifyCliToken } from '@/lib/cli/cliAuth'
import { cliSiteStatus, setupCliSite } from '@/lib/cli/cliSite'

async function session(request: NextRequest) {
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  return token ? verifyCliToken(token) : null
}

const NO_STORE = { 'Cache-Control': 'no-store' }

/** GET /api/cli/site — is the creator's website set up, and for which URLs. */
export const GET = withRouteErrors('api/cli/site', async function GET(request: NextRequest) {
  const auth = await session(request)
  if (!auth) return NextResponse.json({ error: 'Log in again: npx @sts-ai/cli init --relogin' }, { status: 401 })
  return NextResponse.json(await cliSiteStatus(auth.userId), { headers: NO_STORE })
})

/**
 * POST /api/cli/site { origins: string[], replace?: boolean } — makes the site key for the
 * creator's website and allows its URLs. The key is returned once, for the CLI to write into
 * `.env.local`. 409 KEY_EXISTS when a key is already live and `replace` was not set.
 */
export const POST = withRouteErrors('api/cli/site', async function POST(request: NextRequest) {
  const auth = await session(request)
  if (!auth) return NextResponse.json({ error: 'Log in again: npx @sts-ai/cli init --relogin' }, { status: 401 })
  const limit = await checkRateLimit(`cli-site:${auth.userId}`, 10, 60 * 60 * 1000)
  if (!limit.ok) return NextResponse.json({ error: 'Too many website setups this hour. Try again later.' }, { status: 429 })

  const body = await readJsonObject<{ origins: unknown; replace: unknown }>(request)
  const origins = Array.isArray(body?.origins) ? body.origins.filter((o): o is string => typeof o === 'string') : []
  const result = await setupCliSite(auth.userId, { origins, replace: body?.replace === true })
  if (result.ok) return NextResponse.json(result, { headers: NO_STORE })
  if (result.code === 'KEY_EXISTS') {
    return NextResponse.json({ code: result.code, allowedOrigins: result.allowedOrigins, error: 'A website key is already in use.' }, { status: 409 })
  }
  return NextResponse.json(
    {
      code: result.code,
      error: result.code === 'NO_BUSINESS' ? 'Finish setting up your business in sts-ai first.' : 'Give your website address (e.g. https://your-site.com).',
    },
    { status: 400 },
  )
})
