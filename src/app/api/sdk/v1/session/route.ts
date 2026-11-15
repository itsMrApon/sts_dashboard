import { prismaClient } from '@/lib/prismaClient'
import { getBusinessByRoomName } from '@/lib/business/creatorBusiness'
import { issueEmbedSessionForRequest, sessionPayload } from '@/lib/embed/issueEmbedSessionRoute'
import { EMBED_RATE_LIMITS } from '@/lib/embed/rateLimit'
import { hashSiteKey } from '@/lib/embed/siteKey'
import { getSiteKeyFromRequest } from '@/lib/embed/verifySiteKeyAccess'
import { buildSdkSessionPayload } from '@/lib/sdk/sdkPayload'
import { sdkError, sdkJson, sdkOptions, SDK_ROUTE_ERROR_CORS } from '@/lib/sdk/sdkGuard'
import { withRouteErrors } from '@/lib/http/routeErrors'
export const OPTIONS = withRouteErrors('api/sdk/v1/session', async function OPTIONS(request: Request) {
  return sdkOptions(request)
}, SDK_ROUTE_ERROR_CORS)

/** Site key + allowlisted Origin → short-lived session + the business's enabled services. */
export const POST = withRouteErrors('api/sdk/v1/session', async function POST(request: Request) {
  const siteKey = getSiteKeyFromRequest(request)
  if (!siteKey) return sdkError(request, 401, 'SITE_KEY_REQUIRED', 'X-Sts-Site-Key header is required.')

  const config = await prismaClient.roomEmbedConfig.findUnique({
    where: { siteKeyHash: hashSiteKey(siteKey) },
    select: { roomName: true },
  })
  if (!config) return sdkError(request, 401, 'INVALID_SITE_KEY', 'Invalid site key.')

  const issued = await issueEmbedSessionForRequest(request, config.roomName, {
    name: 'sdk-session',
    ...EMBED_RATE_LIMITS.session,
  })
  if (!issued.ok) return issued.response

  const business = await getBusinessByRoomName(config.roomName)
  if (!business) return sdkError(request, 404, 'BUSINESS_NOT_FOUND', 'Business not found.')

  return sdkJson(
    { session: sessionPayload(issued.session), ...(await buildSdkSessionPayload(business)) },
    issued.corsHeaders,
  )
}, SDK_ROUTE_ERROR_CORS)
