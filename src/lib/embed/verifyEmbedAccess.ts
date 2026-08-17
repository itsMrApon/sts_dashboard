import type { RoomEmbedConfig } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { isSameAppOrigin } from '@/lib/embed/origin'
import {
  getSiteKeyFromRequest,
  verifySiteKeyAgainstConfig,
} from '@/lib/embed/verifySiteKeyAccess'

export type EmbedAccessMode = 'open' | 'same-origin' | 'embed'

export type EmbedAccessResult =
  | { ok: true; config: RoomEmbedConfig | null; mode: EmbedAccessMode }
  | { ok: false; status: number; code: string; message: string }

export { getSiteKeyFromRequest } from '@/lib/embed/verifySiteKeyAccess'

export async function verifyEmbedAccess(
  request: Request,
  roomName: string,
): Promise<EmbedAccessResult> {
  const config = await prismaClient.roomEmbedConfig.findUnique({
    where: { roomName },
  })

  if (!config || !config.enabled) {
    return { ok: true, config: config ?? null, mode: 'open' }
  }

  const siteKey = getSiteKeyFromRequest(request)
  if (!siteKey) {
    if (isSameAppOrigin(request)) {
      return { ok: true, config, mode: 'same-origin' }
    }
    return {
      ok: false,
      status: 401,
      code: 'SITE_KEY_REQUIRED',
      message: 'X-Sts-Site-Key header is required for embedded access.',
    }
  }

  const keyCheck = verifySiteKeyAgainstConfig(request, config, { requireEnabled: true })
  if (!keyCheck.ok) {
    return keyCheck
  }

  return { ok: true, config, mode: 'embed' }
}

export function embedAccessJsonError(result: Extract<EmbedAccessResult, { ok: false }>) {
  return {
    error: result.message,
    code: result.code,
  }
}
