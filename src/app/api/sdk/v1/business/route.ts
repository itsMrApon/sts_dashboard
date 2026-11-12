import { EMBED_RATE_LIMITS } from '@/lib/embed/rateLimit'
import { loadPublishedWorkspaceProfile } from '@/lib/public/loadBusinessProfile'
import { guardSdkRequest, sdkJson, sdkOptions } from '@/lib/sdk/sdkGuard'

export async function OPTIONS(request: Request) {
  return sdkOptions(request)
}

/** Business details for the website (name, description, published profile/services when available). */
export async function GET(request: Request) {
  const guard = await guardSdkRequest(request, { scope: 'read', perIp: EMBED_RATE_LIMITS.read })
  if (!guard.ok) return guard.response

  const profile = await loadPublishedWorkspaceProfile(guard.business.workspaceId)
  return sdkJson(
    {
      business: {
        name: guard.business.name,
        description: guard.business.description,
        profile: profile.ok ? profile.compact : null,
        publishedAt: profile.ok ? (profile.publishedAt?.toISOString() ?? null) : null,
      },
    },
    guard.corsHeaders,
  )
}
