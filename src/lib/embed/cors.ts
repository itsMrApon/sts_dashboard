import type { RoomEmbedConfig } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { isDevLocalhostOrigin, isOriginAllowed, normalizeOrigin } from '@/lib/embed/origin'

type CorsConfig = Pick<RoomEmbedConfig, 'allowedOrigins' | 'enabled'> | null

function corsHeadersForOrigin(normalizedOrigin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': normalizedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Sts-Site-Key, X-Sts-Session',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

/**
 * CORS only for an enabled embed config and an allowlisted origin.
 * First-party (same-origin) requests need no CORS headers, so nothing is reflected otherwise.
 */
export function embedCorsHeadersForConfig(request: Request, config: CorsConfig): HeadersInit {
  const origin = request.headers.get('origin')
  if (!origin || !config?.enabled) return {}
  const normalized = normalizeOrigin(origin)
  if (!normalized || !isOriginAllowed(normalized, config.allowedOrigins)) return {}
  return corsHeadersForOrigin(normalized)
}

export async function loadEmbedConfig(roomName: string) {
  return prismaClient.roomEmbedConfig.findUnique({ where: { roomName } })
}

export async function embedCorsHeadersForRoom(
  request: Request,
  roomName: string,
): Promise<HeadersInit> {
  if (!request.headers.get('origin')) return {}
  return embedCorsHeadersForConfig(request, await loadEmbedConfig(roomName))
}

/** On auth errors in dev, still reflect localhost origin so the browser can read the JSON error body. */
export function embedCorsHeadersForError(request: Request): HeadersInit {
  const origin = request.headers.get('origin')
  if (!origin || !isDevLocalhostOrigin(origin)) return {}
  const normalized = normalizeOrigin(origin)
  return normalized ? corsHeadersForOrigin(normalized) : {}
}

export async function embedOptionsForRoom(request: Request, roomName: string) {
  const corsHeaders = await embedCorsHeadersForRoom(request, roomName)
  const headers = Object.keys(corsHeaders).length > 0 ? corsHeaders : embedCorsHeadersForError(request)
  return new Response(null, { status: 204, headers })
}
