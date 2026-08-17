import type { RoomEmbedConfig } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import {
  getSiteKeyFromRequest,
  verifySiteKeyAgainstConfig,
} from '@/lib/embed/verifySiteKeyAccess'

export type PublicAccessResult =
  | { ok: true; config: RoomEmbedConfig }
  | { ok: false; status: number; code: string; message: string }

export async function findEmbedConfigForWorkspace(
  workspaceId: string,
): Promise<RoomEmbedConfig | null> {
  try {
    const direct = await prismaClient.roomEmbedConfig.findFirst({
      where: { workspaceId, enabled: true },
      orderBy: { updatedAt: 'desc' },
    })
    if (direct) return direct
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code !== 'P2022') throw error
  }

  const channel = await prismaClient.messageChannel.findFirst({
    where: { workspaceId },
    orderBy: { updatedAt: 'desc' },
    select: { roomName: true },
  })
  if (channel) {
    const byRoom = await prismaClient.roomEmbedConfig.findUnique({
      where: { roomName: channel.roomName },
    })
    if (byRoom) return byRoom
  }

  return null
}

/** @deprecated prefer findEmbedConfigForWorkspace */
export async function findEmbedConfigForBusiness(
  publishProfileId: string,
): Promise<RoomEmbedConfig | null> {
  try {
    const direct = await prismaClient.roomEmbedConfig.findFirst({
      where: { publishProfileId, enabled: true },
      orderBy: { updatedAt: 'desc' },
    })
    if (direct) return direct
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code !== 'P2022') throw error
  }

  const workspace = await prismaClient.workspace.findFirst({
    where: { publishProfileId },
    orderBy: { publishedAt: 'desc' },
    select: { id: true },
  })
  if (!workspace) return null
  return findEmbedConfigForWorkspace(workspace.id)
}

export async function verifyPublicAccess(
  request: Request,
  workspaceId: string,
): Promise<PublicAccessResult> {
  const config = await findEmbedConfigForWorkspace(workspaceId)
  if (!config) {
    return {
      ok: false,
      status: 404,
      code: 'PUBLIC_ACCESS_NOT_CONFIGURED',
      message:
        'Public API access is not configured for this workspace. Enable embed on a Messages room and set allowed origins.',
    }
  }

  if (!config.workspaceId) {
    try {
      await prismaClient.roomEmbedConfig.update({
        where: { id: config.id },
        data: { workspaceId },
      })
      config.workspaceId = workspaceId
    } catch (error) {
      const code = (error as { code?: string })?.code
      if (code !== 'P2022') throw error
    }
  }

  const siteKey = getSiteKeyFromRequest(request)
  if (!siteKey) {
    return {
      ok: false,
      status: 401,
      code: 'SITE_KEY_REQUIRED',
      message: 'X-Sts-Site-Key header is required.',
    }
  }

  const keyCheck = verifySiteKeyAgainstConfig(request, config, { requireEnabled: true })
  if (!keyCheck.ok) {
    return keyCheck
  }

  return { ok: true, config }
}

export function publicAccessJsonError(result: Extract<PublicAccessResult, { ok: false }>) {
  return {
    error: result.message,
    code: result.code,
  }
}
