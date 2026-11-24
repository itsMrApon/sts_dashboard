import { EMBED_RATE_LIMITS } from '@/lib/embed/rateLimit'
import { withRouteErrors } from '@/lib/http/routeErrors'
import { loadPublishedWorkspaceProfile } from '@/lib/public/loadBusinessProfile'
import { loadApprovedReviews } from '@/lib/reviews/reviews'
import { guardSdkRequest, sdkJson, sdkOptions, SDK_ROUTE_ERROR_CORS } from '@/lib/sdk/sdkGuard'

export const OPTIONS = withRouteErrors('api/sdk/v1/reviews', async function OPTIONS(request: Request) {
  return sdkOptions(request)
}, SDK_ROUTE_ERROR_CORS)

/** Reviews the creator chose to show (Services → Reviews), for a reviews block on their website. */
export const GET = withRouteErrors('api/sdk/v1/reviews', async function GET(request: Request) {
  const guard = await guardSdkRequest(request, { scope: 'read', perIp: EMBED_RATE_LIMITS.read })
  if (!guard.ok) return guard.response
  const profile = await loadPublishedWorkspaceProfile(guard.business.workspaceId)
  const reviews = profile.ok ? await loadApprovedReviews(guard.business.userId, 12) : []
  return sdkJson({ reviews }, guard.corsHeaders)
}, SDK_ROUTE_ERROR_CORS)
