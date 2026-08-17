'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath, unstable_cache } from 'next/cache'
import { prismaClient } from '@/lib/prismaClient'
import { startPerf, timeAsync } from '@/lib/dev/perf'
import { onAuthenticateUser } from './auth'
import { verifyRoomOwnership } from '@/lib/messages/verifyRoomOwnership'

type ActionResult<T = undefined> = T extends undefined
  ? { ok: true } | { ok: false; error: string }
  : { ok: true; data: T } | { ok: false; error: string }

export type HomePreviewData = {
  roomName: string
  agentName: string
  firstMessage: string | null
  businessName: string
  socialAccounts: { platform: string; label: string; url?: string }[]
}

export type MessageRoomData = {
  id: string
  name: string
  description: string | null
  agents: {
    isPrimary: boolean
    agent: { id: string; name: string; roomName: string }
  }[]
  channels: { roomName: string }[]
  products: {
    isPrimary: boolean
    webinar: { id: string; title: string; kind: string }
  }[]
  productsCount: number
  _count: { channels: number }
}

type MessageRoomRow = {
  id: string
  name: string
  description: string | null
  agents: MessageRoomData['agents']
  channels: MessageRoomData['channels']
  products: MessageRoomData['products']
  workspaces: { id: string }[]
  _count: { channels: number; products: number }
}

const getHomePreviewDataCached = unstable_cache(
  async (userId: string): Promise<HomePreviewData | null> => {
    const business = await prismaClient.publishProfile.findFirst({
      where: { userId },
      orderBy: [{ isHomeFeatured: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        userId: true,
        name: true,
        agents: {
          orderBy: { isPrimary: 'desc' },
          take: 1,
          select: {
            agent: {
              select: {
                roomName: true,
                name: true,
                firstMessage: true,
              },
            },
          },
        },
      },
    })

    const primaryAgent = business?.agents[0]?.agent
    if (!business || !primaryAgent?.roomName || !primaryAgent.name) {
      return null
    }

    const outreach = await prismaClient.outreachChannel.findMany({
      where: {
        userId: business.userId,
        status: 'ACTIVE',
      },
      select: {
        platform: true,
        accountLabel: true,
        pageUrl: true,
      },
    })

    return {
      roomName: primaryAgent.roomName,
      agentName: primaryAgent.name,
      firstMessage: primaryAgent.firstMessage,
      businessName: business.name,
      socialAccounts: outreach.map((o) => ({
        platform: o.platform,
        label: o.accountLabel,
        url: o.pageUrl ?? undefined,
      })),
    }
  },
  ['home-preview-data'],
  { revalidate: 20 },
)

/** Create a publish profile with only name/description (no agents/products). Link agents from Messages later if needed. */
export async function createPublishProfileQuick(data: {
  name: string
  description?: string
  logo?: string
}): Promise<ActionResult<{ id: string }>> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return { ok: false, error: 'UNAUTHENTICATED' }

  const user = await prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!user) return { ok: false, error: 'User not found' }

  if (!data.name.trim()) return { ok: false, error: 'Publish profile name is required' }

  try {
    const business = await prismaClient.publishProfile.create({
      data: {
        userId: user.id,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        logo: data.logo?.trim() || null,
      },
    })

    revalidatePath('/messages')
    revalidatePath('/tenants')
    revalidatePath('/tenants/publish')
    revalidatePath('/tenants/publish')
    return { ok: true, data: { id: business.id } }
  } catch (error) {
    console.error('createPublishProfileQuick error', error)
    return { ok: false, error: 'Failed to create publish profile' }
  }
}

export async function createPublishProfile(data: {
  name: string
  description?: string
  agentIds: string[]
  productIds: string[]
  primaryAgentId?: string
  primaryProductId?: string
  /** Optional: link pitch context to primary agent room message channels */
  tenantId?: string | null
}): Promise<ActionResult<{ id: string; primaryRoomName: string | null }>> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return { ok: false, error: 'UNAUTHENTICATED' }

  const user = await prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!user) return { ok: false, error: 'User not found' }

  if (!data.name.trim()) return { ok: false, error: 'Publish profile name is required' }
  if (data.agentIds.length === 0)
    return { ok: false, error: 'At least one AI agent is required' }

  try {
    const business = await prismaClient.publishProfile.create({
      data: {
        userId: user.id,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        agents: {
          create: data.agentIds.map((agentId) => ({
            agentId,
            isPrimary: agentId === (data.primaryAgentId || data.agentIds[0]),
          })),
        },
        products: {
          create: data.productIds.map((webinarId) => ({
            webinarId,
            isPrimary: webinarId === (data.primaryProductId || data.productIds[0]),
          })),
        },
      },
      include: {
        agents: {
          where: { isPrimary: true },
          include: { agent: { select: { roomName: true } } },
        },
      },
    })

    const primaryRoomName = business.agents[0]?.agent.roomName || null

    let resolvedTenantId: string | undefined
    if (data.tenantId) {
      const tenant = await prismaClient.workspace.findFirst({
        where: { id: data.tenantId, userId: user.id },
        select: { id: true, publishProfileId: true },
      })
      if (tenant) {
        resolvedTenantId = tenant.id
        if (!tenant.publishProfileId) {
          await prismaClient.workspace.update({
            where: { id: tenant.id },
            data: { publishProfileId: business.id },
          })
        }
      }
    }

    if (primaryRoomName) {
      await prismaClient.messageChannel.updateMany({
        where: { roomName: primaryRoomName },
        data: {
          publishProfileId: business.id,
          ...(resolvedTenantId ? { workspaceId: resolvedTenantId } : {}),
        },
      })
    }

    revalidatePath('/messages')
    if (primaryRoomName) {
      revalidatePath(`/messages/${primaryRoomName}`)
    }
    return { ok: true, data: { id: business.id, primaryRoomName } }
  } catch (error) {
    console.error('createPublishProfile error', error)
    return { ok: false, error: 'Failed to create publish profile' }
  }
}

export async function updatePublishProfile(
  publishProfileId: string,
  data: {
    name?: string
    description?: string
    agentIds?: string[]
    productIds?: string[]
    primaryAgentId?: string
    primaryProductId?: string
    /** Optional tenant pitch to sync on primary room channels */
    tenantId?: string | null
  },
): Promise<ActionResult> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return { ok: false, error: 'UNAUTHENTICATED' }

  const user = await prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!user) return { ok: false, error: 'User not found' }

  const existing = await prismaClient.publishProfile.findFirst({
    where: { id: publishProfileId, userId: user.id },
  })
  if (!existing) return { ok: false, error: 'Publish profile not found' }
  if (data.tenantId) {
    const tenant = await prismaClient.workspace.findFirst({
      where: { id: data.tenantId, userId: user.id },
      select: { id: true },
    })
    if (!tenant) return { ok: false, error: 'Tenant not found' }
  }

  try {
    await prismaClient.publishProfile.update({
      where: { id: publishProfileId },
      data: {
        name: data.name?.trim() || undefined,
        description: data.description?.trim() ?? undefined,
      },
    })

    if (data.agentIds) {
      await prismaClient.publishAgent.deleteMany({ where: { publishProfileId } })
      if (data.agentIds.length > 0) {
        await prismaClient.publishAgent.createMany({
          data: data.agentIds.map((agentId) => ({
            publishProfileId,
            agentId,
            isPrimary: agentId === (data.primaryAgentId || data.agentIds![0]),
          })),
        })
      }
    }

    if (data.productIds) {
      await prismaClient.publishProduct.deleteMany({ where: { publishProfileId } })
      if (data.productIds.length > 0) {
        await prismaClient.publishProduct.createMany({
          data: data.productIds.map((webinarId) => ({
            publishProfileId,
            webinarId,
            isPrimary: webinarId === (data.primaryProductId || data.productIds![0]),
          })),
        })
      }
    }

    let primaryRoomName: string | null = null
    if (data.agentIds && data.agentIds.length > 0) {
      const primaryAgentId = data.primaryAgentId || data.agentIds[0]
      const primaryAgent = await prismaClient.liveKitAgent.findUnique({
        where: { id: primaryAgentId },
        select: { roomName: true },
      })
      primaryRoomName = primaryAgent?.roomName ?? null
    }

    if (primaryRoomName) {
      await prismaClient.messageChannel.updateMany({
        where: { roomName: primaryRoomName },
        data: {
          publishProfileId,
          ...(data.tenantId ? { workspaceId: data.tenantId } : {}),
        },
      })
      revalidatePath(`/messages/${primaryRoomName}`)
    }

    revalidatePath('/messages')
    return { ok: true }
  } catch (error) {
    console.error('updatePublishProfile error', error)
    return { ok: false, error: 'Failed to update publish profile' }
  }
}

/** Pin this messaging room's web chat as the live preview on the Home page. */
export async function setHomeFeaturedRoom(roomName: string): Promise<ActionResult> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return { ok: false, error: 'UNAUTHENTICATED' }

  const ownership = await verifyRoomOwnership(roomName)
  if (!ownership.ok) return { ok: false, error: ownership.reason }
  if (!ownership.agent) {
    return { ok: false, error: 'No AI agent linked to this room' }
  }

  const user = await prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!user) return { ok: false, error: 'User not found' }

  const link = await prismaClient.publishAgent.findFirst({
    where: {
      agentId: ownership.agent.id,
      publishProfile: { userId: user.id },
    },
    select: { publishProfileId: true },
  })

  if (!link) {
    return {
      ok: false,
      error: 'Link this room to a publish profile first (Messages → New room).',
    }
  }

  try {
    await prismaClient.$transaction([
      prismaClient.publishProfile.updateMany({
        where: { userId: user.id, isHomeFeatured: true },
        data: { isHomeFeatured: false },
      }),
      prismaClient.publishProfile.update({
        where: { id: link.publishProfileId },
        data: { isHomeFeatured: true },
      }),
      prismaClient.publishAgent.updateMany({
        where: { publishProfileId: link.publishProfileId },
        data: { isPrimary: false },
      }),
      prismaClient.publishAgent.updateMany({
        where: { publishProfileId: link.publishProfileId, agentId: ownership.agent.id },
        data: { isPrimary: true },
      }),
    ])

    revalidatePath('/home')
    revalidatePath('/messages')
    revalidatePath(`/messages/${roomName}`)
    return { ok: true }
  } catch (error) {
    console.error('setHomeFeaturedRoom error', error)
    return { ok: false, error: 'Failed to set homepage room' }
  }
}

/**
 * Minimal lookup for Home AI preview only — avoids loading every business, product, and webinar.
 */
export async function getHomePrimaryAgentRoomName(): Promise<string | null> {
  const timer = startPerf('publishProfiles.getHomePrimaryAgentRoomName')
  const authResult = await timeAsync('publishProfiles.getHomePrimaryAgentRoomName.onAuthenticateUser', () =>
    onAuthenticateUser(),
  )
  if (!authResult.user) {
    timer.end({ reason: 'no-auth-user' })
    return null
  }

  const business = await timeAsync(
    'publishProfiles.getHomePrimaryAgentRoomName.publishProfile.findFirst',
    () =>
      prismaClient.publishProfile.findFirst({
        where: { userId: authResult.user.id },
        orderBy: [{ isHomeFeatured: 'desc' }, { createdAt: 'desc' }],
        select: {
          agents: {
            orderBy: { isPrimary: 'desc' },
            take: 1,
            select: {
              agent: { select: { roomName: true } },
            },
          },
        },
      }),
  )

  const result = business?.agents[0]?.agent.roomName ?? null
  timer.end({ hasRoom: Boolean(result) })
  return result
}

export async function getHomePreviewData(): Promise<HomePreviewData | null> {
  const timer = startPerf('publishProfiles.getHomePreviewData')
  const authResult = await timeAsync('publishProfiles.getHomePreviewData.onAuthenticateUser', () =>
    onAuthenticateUser(),
  )
  if (!authResult.user) {
    timer.end({ reason: 'no-auth-user' })
    return null
  }

  const result = await timeAsync('publishProfiles.getHomePreviewData.cached', () =>
    getHomePreviewDataCached(authResult.user.id),
  )
  if (!result) {
    timer.end({ reason: 'no-primary-agent' })
    return null
  }

  timer.end({
    hasSocialAccounts: result.socialAccounts.length > 0,
  })
  return result
}

export async function getPublishProfiles() {
  const timer = startPerf('publishProfiles.getPublishProfiles')
  const authResult = await timeAsync('publishProfiles.getPublishProfiles.onAuthenticateUser', () =>
    onAuthenticateUser(),
  )
  if (!authResult.user) {
    timer.end({ reason: 'no-auth-user' })
    return []
  }

  const rows = await timeAsync('publishProfiles.getPublishProfiles.publishProfile.findMany', () =>
    prismaClient.publishProfile.findMany({
      where: { userId: authResult.user.id },
      include: {
        agents: {
          include: {
            agent: {
              select: { id: true, name: true, roomName: true },
            },
          },
          orderBy: { isPrimary: 'desc' },
        },
        products: {
          include: {
            webinar: {
              select: { id: true, title: true, kind: true },
            },
          },
          orderBy: { isPrimary: 'desc' },
        },
        /** Any linked message channel carries the agent roomName for /messages/[roomName] */
        channels: {
          take: 1,
          select: { roomName: true },
          orderBy: { updatedAt: 'desc' },
        },
        workspaces: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: { id: true },
        },
        _count: { select: { channels: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  )
  timer.end({ count: rows.length })
  return rows
}

const getPublishProfileOptionsCached = unstable_cache(
  async (userId: string) =>
    prismaClient.publishProfile.findMany({
      where: { userId },
      select: { id: true, name: true, logo: true },
      orderBy: { createdAt: 'desc' },
    }),
  ['business-options'],
  { revalidate: 15 },
)

export async function getPublishProfileOptions(resolvedUserId?: string) {
  const timer = startPerf('publishProfiles.getPublishProfileOptions')
  let userId = resolvedUserId
  if (!userId) {
    const authResult = await timeAsync('publishProfiles.getPublishProfileOptions.onAuthenticateUser', () =>
      onAuthenticateUser(),
    )
    if (!authResult.user) {
      timer.end({ reason: 'no-auth-user' })
      return []
    }
    userId = authResult.user.id
  }

  const rows = await timeAsync('publishProfiles.getPublishProfileOptions.cached', () =>
    getPublishProfileOptionsCached(userId!),
  )
  timer.end({ count: rows.length })
  return rows
}

const getMessageRoomsDataCached = unstable_cache(
  async (userId: string) =>
    prismaClient.publishProfile.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        description: true,
        agents: {
          select: {
            isPrimary: true,
            agent: {
              select: { id: true, name: true, roomName: true },
            },
          },
          orderBy: { isPrimary: 'desc' },
        },
        channels: {
          take: 1,
          select: { roomName: true },
          orderBy: { updatedAt: 'desc' },
        },
        products: {
          take: 6,
          select: {
            isPrimary: true,
            webinar: {
              select: { id: true, title: true, kind: true },
            },
          },
          orderBy: { isPrimary: 'desc' },
        },
        workspaces: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: { id: true },
        },
        _count: { select: { channels: true, products: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ['message-rooms-data'],
  { revalidate: 10 },
)

export async function getMessageRoomsData(resolvedUserId?: string): Promise<
  Array<MessageRoomData & { profileTenantId: string | null }>
> {
  const timer = startPerf('publishProfiles.getMessageRoomsData')
  let userId = resolvedUserId
  if (!userId) {
    const authResult = await timeAsync('publishProfiles.getMessageRoomsData.onAuthenticateUser', () =>
      onAuthenticateUser(),
    )
    if (!authResult.user) {
      timer.end({ reason: 'no-auth-user' })
      return []
    }
    userId = authResult.user.id
  }

  const rows = (await timeAsync('publishProfiles.getMessageRoomsData.cached', () =>
    getMessageRoomsDataCached(userId!),
  )) as unknown as MessageRoomRow[]

  const rooms: MessageRoomData[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    agents: row.agents,
    channels: row.channels,
    products: row.products,
    productsCount: row._count.products,
    _count: { channels: row._count.channels },
  }))

  timer.end({ count: rooms.length })
  return rooms.map((room, index) => ({
    ...room,
    profileTenantId: rows[index].workspaces[0]?.id ?? null,
    profileWorkspaceId: rows[index].workspaces[0]?.id ?? null,
  }))
}

export async function getPublishProfileByRoomName(roomName: string) {
  const agent = await prismaClient.liveKitAgent.findUnique({
    where: { roomName },
    select: { id: true },
  })
  if (!agent) return null

  const link = await prismaClient.publishAgent.findFirst({
    where: { agentId: agent.id },
    include: {
      publishProfile: {
        include: {
          agents: {
            include: {
              agent: {
                select: { id: true, name: true, roomName: true, firstMessage: true },
              },
            },
          },
          products: {
            include: {
              webinar: {
                select: {
                  id: true,
                  title: true,
                  description: true,
                  kind: true,
                  ctaType: true,
                  ctaUrl: true,
                  ctaLabel: true,
                  couponCode: true,
                  couponEnabled: true,
                },
              },
            },
          },
        },
      },
    },
  })

  return link?.publishProfile || null
}

export async function deletePublishProfile(publishProfileId: string): Promise<ActionResult> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return { ok: false, error: 'UNAUTHENTICATED' }

  const user = await prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!user) return { ok: false, error: 'User not found' }

  try {
    await prismaClient.publishProfile.deleteMany({
      where: { id: publishProfileId, userId: user.id },
    })

    revalidatePath('/messages')
    revalidatePath('/tenants')
    revalidatePath('/tenants/publish')
    revalidatePath('/tenants/publish')
    return { ok: true }
  } catch (error) {
    console.error('deletePublishProfile error', error)
    return { ok: false, error: 'Failed to delete publish profile' }
  }
}
