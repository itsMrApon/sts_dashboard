import { NextRequest } from 'next/server'
import { loadPublishedWorkspaceProfile } from '@/lib/public/loadBusinessProfile'
import {
  clientIp,
  guardPublicRequest,
  jsonWithCors,
  PUBLIC_RATE_LIMITS,
} from '@/lib/public/publicRouteGuard'
import { publicOptionsForWorkspace } from '@/lib/public/cors'

type RouteParams = { params: Promise<{ workspaceId: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { workspaceId } = await params
  const guard = await guardPublicRequest(request, workspaceId, {
    key: `public:profile:${workspaceId}:${clientIp(request)}`,
    ...PUBLIC_RATE_LIMITS.profile,
  })
  if (!guard.ok) return guard.response

  const profile = await loadPublishedWorkspaceProfile(workspaceId)
  if (!profile.ok) {
    return jsonWithCors(
      { error: profile.message, code: profile.code },
      guard.corsHeaders,
      { status: profile.status },
    )
  }

  return jsonWithCors(
    {
      success: true,
      workspaceId: profile.workspaceId,
      workspaceName: profile.workspaceName,
      contextVersion: profile.contextVersion,
      publishedAt: profile.publishedAt?.toISOString() ?? null,
      vertical: typeof profile.compact.vertical === 'string' ? profile.compact.vertical : null,
      profile: profile.compact,
    },
    guard.corsHeaders,
  )
}

export async function OPTIONS(request: NextRequest, { params }: RouteParams) {
  const { workspaceId } = await params
  return publicOptionsForWorkspace(request, workspaceId)
}
