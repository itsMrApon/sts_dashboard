import { NextRequest } from 'next/server'
import { buildServicesResponse } from '@/lib/public/extractServices'
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
  const type = request.nextUrl.searchParams.get('type')?.trim().toLowerCase() || 'all'

  const guard = await guardPublicRequest(request, workspaceId, {
    key: `public:services:${workspaceId}:${clientIp(request)}`,
    ...PUBLIC_RATE_LIMITS.services,
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
    buildServicesResponse(workspaceId, profile.contextVersion, profile.industry, type),
    guard.corsHeaders,
  )
}

export async function OPTIONS(request: NextRequest, { params }: RouteParams) {
  const { workspaceId } = await params
  return publicOptionsForWorkspace(request, workspaceId)
}
