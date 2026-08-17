import { unstable_cache } from 'next/cache'
import { prismaClient } from '@/lib/prismaClient'
import { ChannelStatus, type MessageChannel } from '@prisma/client'

export type RoomBusinessData = {
  id: string
  name: string
  isHomeFeatured: boolean
  agents: {
    isPrimary: boolean
    agent: { id: string; name: string; roomName: string }
  }[]
  products: {
    isPrimary: boolean
    webinar: { id: string; title: string; kind: 'PROJECT' | 'PRODUCT'; description: string | null }
  }[]
}

export type SelectableAgentOption = {
  id: string
  name: string
  roomName: string
}

export type SelectableProductOption = {
  id: string
  title: string
  kind: 'PROJECT' | 'PRODUCT'
}

export type RoomPageData = {
  publishProfile: RoomBusinessData | null
  channels: MessageChannel[]
  /** @deprecated Prefer currentWorkspace + workspaces */
  legacyPitchTenant: { id: string; name: string } | null
  currentWorkspace: { id: string; name: string; publishName: string | null } | null
  workspaces: Array<{ id: string; name: string; publishName: string | null }>
}

/** Critical room shell only — channels, workspace, linked publish profile. */
export const getRoomPageDataCached = unstable_cache(
  async (userId: string, roomName: string, agentId: string | null): Promise<RoomPageData> => {
    const [agentLink, channels, workspaceRows] = await Promise.all([
      agentId
        ? prismaClient.publishAgent.findFirst({
            where: { agentId },
            select: { publishProfileId: true },
          })
        : Promise.resolve(null),
      prismaClient.messageChannel.findMany({
        where: { roomName },
      }),
      prismaClient.workspace.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          publishProfileId: true,
          publishProfile: { select: { name: true } },
        },
      }),
    ])

    let resolvedBusinessId =
      agentLink?.publishProfileId ??
      channels.find((c) => c.publishProfileId)?.publishProfileId ??
      null

    if (!resolvedBusinessId) {
      const channelRow = await prismaClient.messageChannel.findFirst({
        where: {
          roomName,
          publishProfileId: { not: null },
          publishProfile: { userId },
        },
        select: { publishProfileId: true },
      })
      resolvedBusinessId = channelRow?.publishProfileId ?? null
    }

    let business: RoomBusinessData | null = null
    if (resolvedBusinessId) {
      const businessRow = await prismaClient.publishProfile.findFirst({
        where: { id: resolvedBusinessId, userId },
        select: {
          id: true,
          name: true,
          isHomeFeatured: true,
          agents: {
            orderBy: { isPrimary: 'desc' },
            select: {
              isPrimary: true,
              agent: { select: { id: true, name: true, roomName: true } },
            },
          },
          products: {
            orderBy: { isPrimary: 'desc' },
            select: {
              isPrimary: true,
              webinar: {
                select: { id: true, title: true, kind: true, description: true },
              },
            },
          },
        },
      })
      if (businessRow) {
        business = businessRow
      }
    }

    const channelWithWorkspace =
      channels.find((c) => c.status === ChannelStatus.ACTIVE && c.workspaceId) ||
      channels.find((c) => Boolean(c.workspaceId)) ||
      null

    let currentWorkspaceId = channelWithWorkspace?.workspaceId || null

    if (!currentWorkspaceId && business?.id) {
      const linked = workspaceRows.find((w) => w.publishProfileId === business.id)
      currentWorkspaceId = linked?.id ?? null
    }

    if (!currentWorkspaceId) {
      const channelBusinessId =
        channels.find((c) => c.publishProfileId)?.publishProfileId ?? null
      if (channelBusinessId) {
        const linked = workspaceRows.find((w) => w.publishProfileId === channelBusinessId)
        currentWorkspaceId = linked?.id ?? null
      }
    }

    const workspaces = workspaceRows.map((w) => ({
      id: w.id,
      name: w.name,
      publishName: w.publishProfile?.name ?? null,
    }))

    let currentWorkspace: { id: string; name: string; publishName: string | null } | null = null
    let legacyPitchTenant: { id: string; name: string } | null = null
    if (currentWorkspaceId) {
      const pitchRow = workspaceRows.find((w) => w.id === currentWorkspaceId)
      if (pitchRow) {
        currentWorkspace = {
          id: pitchRow.id,
          name: pitchRow.name,
          publishName: pitchRow.publishProfile?.name ?? null,
        }
        if (!pitchRow.publishProfileId) {
          legacyPitchTenant = { id: pitchRow.id, name: pitchRow.name }
        }
      }
    }

    return {
      publishProfile: business,
      channels,
      legacyPitchTenant,
      currentWorkspace,
      workspaces,
    }
  },
  ['messages-room-page-data-v3'],
  { revalidate: 10 },
)

/** Deferred editor options — not required for channel/workspace first paint. */
export const getRoomSelectableOptionsCached = unstable_cache(
  async (userId: string) => {
    const [selectableAgents, selectableProducts] = await Promise.all([
      prismaClient.liveKitAgent.findMany({
        where: {
          OR: [
            { publishAgents: { none: {} } },
            {
              publishAgents: {
                some: { publishProfile: { userId } },
              },
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, roomName: true },
      }),
      prismaClient.webinar.findMany({
        where: { presenterId: userId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, kind: true },
      }),
    ])

    return { selectableAgents, selectableProducts }
  },
  ['messages-room-selectable-options-v1'],
  { revalidate: 15 },
)
