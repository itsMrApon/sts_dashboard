import { prismaClient } from '@/lib/prismaClient'
import {
  isDevLocalhostOrigin,
  isOriginAllowed,
  normalizeOrigin,
} from '@/lib/embed/origin'

export function embedCorsHeaders(
  request: Request,
  allowedOrigins: string[],
): HeadersInit {
  const origin = request.headers.get('origin')
  if (!origin) return {}

  const normalized = normalizeOrigin(origin)
  if (!normalized) return {}

  if (allowedOrigins.length > 0 && !isOriginAllowed(origin, allowedOrigins)) {
    return {}
  }

  return corsHeadersForOrigin(normalized)
}

function corsHeadersForOrigin(normalizedOrigin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': normalizedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sts-Site-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

/** CORS for embed routes — loads allowed origins from DB; open mode reflects request origin. */
export async function embedCorsHeadersForRoom(
  request: Request,
  roomName: string,
): Promise<HeadersInit> {
  const origin = request.headers.get('origin')
  if (!origin) return {}

  const normalized = normalizeOrigin(origin)
  if (!normalized) return {}

  const config = await prismaClient.roomEmbedConfig.findUnique({
    where: { roomName },
    select: { allowedOrigins: true, enabled: true },
  })

  if (!config?.enabled) {
    return corsHeadersForOrigin(normalized)
  }

  if (isOriginAllowed(origin, config.allowedOrigins)) {
    return corsHeadersForOrigin(normalized)
  }

  return {}
}

/** On auth errors in dev, still reflect origin so the browser can read the JSON error body. */
export function embedCorsHeadersForError(request: Request): HeadersInit {
  const origin = request.headers.get('origin')
  if (!origin || process.env.NODE_ENV !== 'development') return {}
  if (!isDevLocalhostOrigin(origin)) return {}
  const normalized = normalizeOrigin(origin)
  return normalized ? corsHeadersForOrigin(normalized) : {}
}

export async function embedOptionsForRoom(request: Request, roomName: string) {
  const corsHeaders = await embedCorsHeadersForRoom(request, roomName)
  if (Object.keys(corsHeaders).length > 0) {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const fallback = embedCorsHeadersForError(request)
  return new Response(null, { status: 204, headers: fallback })
}

export function optionsResponse(request: Request, allowedOrigins: string[]) {
  const headers = embedCorsHeaders(request, allowedOrigins)
  return new Response(null, { status: 204, headers })
}
