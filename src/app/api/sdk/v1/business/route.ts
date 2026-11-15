import { EMBED_RATE_LIMITS } from '@/lib/embed/rateLimit'
import { prismaClient } from '@/lib/prismaClient'
import { siteContentFromLegacy } from '@/lib/business/siteContent'
import { accentHex } from '@/lib/services/types'
import { loadPublishedWorkspaceProfile } from '@/lib/public/loadBusinessProfile'
import { guardSdkRequest, sdkJson, sdkOptions, SDK_ROUTE_ERROR_CORS } from '@/lib/sdk/sdkGuard'
import { withRouteErrors } from '@/lib/http/routeErrors'
export const OPTIONS = withRouteErrors('api/sdk/v1/business', async function OPTIONS(request: Request) {
  return sdkOptions(request)
}, SDK_ROUTE_ERROR_CORS)

/**
 * Business details for the website: name, description, the published profile, and the published
 * site content (SEO, services, key dates, socials, footer, look) from Services → Business.
 */
export const GET = withRouteErrors('api/sdk/v1/business', async function GET(request: Request) {
  const guard = await guardSdkRequest(request, { scope: 'read', perIp: EMBED_RATE_LIMITS.read })
  if (!guard.ok) return guard.response

  const profile = await loadPublishedWorkspaceProfile(guard.business.workspaceId)
  // Same source as the hosted /business page, and only once the business is published.
  const workspace = profile.ok
    ? await prismaClient.workspace.findUnique({
        where: { id: guard.business.workspaceId },
        select: {
          contextVertical: true,
          contextCoreJson: true,
          contextIndustryJson: true,
          contextSocialJson: true,
        },
      })
    : null
  const site = workspace
    ? siteContentFromLegacy({
        businessName: guard.business.name,
        vertical: workspace.contextVertical,
        core: workspace.contextCoreJson,
        industry: workspace.contextIndustryJson,
        social: workspace.contextSocialJson,
      })
    : null

  return sdkJson(
    {
      business: {
        name: guard.business.name,
        description: guard.business.description,
        profile: profile.ok ? profile.compact : null,
        publishedAt: profile.ok ? (profile.publishedAt?.toISOString() ?? null) : null,
        site: site
          ? {
              ...site,
              services: site.services.filter((service) => service.active),
              appearance: { ...site.appearance, accent: accentHex(site.appearance.accent) },
            }
          : null,
      },
    },
    guard.corsHeaders,
  )
}, SDK_ROUTE_ERROR_CORS)
