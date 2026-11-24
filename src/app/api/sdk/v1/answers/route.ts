import { EMBED_RATE_LIMITS } from '@/lib/embed/rateLimit'
import { withRouteErrors } from '@/lib/http/routeErrors'
import { loadPublishedWorkspaceProfile } from '@/lib/public/loadBusinessProfile'
import { loadSiteAnswers } from '@/lib/questions/questionGroups'
import { guardSdkRequest, sdkJson, sdkOptions, SDK_ROUTE_ERROR_CORS } from '@/lib/sdk/sdkGuard'

export const OPTIONS = withRouteErrors('api/sdk/v1/answers', async function OPTIONS(request: Request) {
  return sdkOptions(request)
}, SDK_ROUTE_ERROR_CORS)

/**
 * The business's answers to the questions customers ask most (Projects → General questions),
 * for an FAQ on the creator's website. Empty until the business is published.
 */
export const GET = withRouteErrors('api/sdk/v1/answers', async function GET(request: Request) {
  const guard = await guardSdkRequest(request, { scope: 'read', perIp: EMBED_RATE_LIMITS.read })
  if (!guard.ok) return guard.response
  const profile = await loadPublishedWorkspaceProfile(guard.business.workspaceId)
  const answers = profile.ok ? await loadSiteAnswers(guard.business.userId) : []
  return sdkJson({ answers }, guard.corsHeaders)
}, SDK_ROUTE_ERROR_CORS)
