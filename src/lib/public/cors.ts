import { isOriginAllowed, normalizeOrigin } from '@/lib/embed/origin'
import { embedCorsHeadersForError } from '@/lib/embed/cors'
import { findEmbedConfigForWorkspace } from '@/lib/public/verifyPublicAccess'

function corsHeadersForOrigin(normalizedOrigin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': normalizedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Sts-Site-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export async function publicCorsHeadersForWorkspace(
  request: Request,
  workspaceId: string,
): Promise<HeadersInit> {
  const origin = request.headers.get('origin')
  if (!origin) return {}

  const normalized = normalizeOrigin(origin)
  if (!normalized) return {}

  const config = await findEmbedConfigForWorkspace(workspaceId)
  if (!config?.enabled) return {}

  if (config.allowedOrigins.length === 0 || isOriginAllowed(origin, config.allowedOrigins)) {
    return corsHeadersForOrigin(normalized)
  }

  return {}
}

export async function publicOptionsForWorkspace(request: Request, workspaceId: string) {
  const corsHeaders = await publicCorsHeadersForWorkspace(request, workspaceId)
  if (Object.keys(corsHeaders).length > 0) {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  return new Response(null, { status: 204, headers: embedCorsHeadersForError(request) })
}

/** @deprecated use publicCorsHeadersForWorkspace */
export const publicCorsHeadersForBusiness = publicCorsHeadersForWorkspace
/** @deprecated use publicOptionsForWorkspace */
export const publicOptionsForBusiness = publicOptionsForWorkspace
