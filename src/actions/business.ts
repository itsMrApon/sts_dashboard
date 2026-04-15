'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { prismaClient } from '@/lib/prismaClient'

type ActionResult<T = undefined> = T extends undefined
  ? { ok: true } | { ok: false; error: string }
  : { ok: true; data: T } | { ok: false; error: string }

/** Create a business with only name/description (no agents/products). Link agents from Messages later if needed. */
export async function createBusinessQuick(data: {
  name: string
  description?: string
}): Promise<ActionResult<{ id: string }>> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return { ok: false, error: 'UNAUTHENTICATED' }

  const user = await prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!user) return { ok: false, error: 'User not found' }

  if (!data.name.trim()) return { ok: false, error: 'Business name is required' }

  try {
    const business = await prismaClient.business.create({
      data: {
        userId: user.id,
        name: data.name.trim(),
        description: data.description?.trim() || null,
      },
    })

    revalidatePath('/messages')
    revalidatePath('/tenants')
    revalidatePath('/tenants/business-profile')
    return { ok: true, data: { id: business.id } }
  } catch (error) {
    console.error('createBusinessQuick error', error)
    return { ok: false, error: 'Failed to create business' }
  }
}

export async function createBusiness(data: {
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

  if (!data.name.trim()) return { ok: false, error: 'Business name is required' }
  if (data.agentIds.length === 0)
    return { ok: false, error: 'At least one AI agent is required' }

  try {
    const business = await prismaClient.business.create({
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
      const tenant = await prismaClient.tenant.findFirst({
        where: { id: data.tenantId, userId: user.id },
        select: { id: true, businessId: true },
      })
      if (tenant) {
        resolvedTenantId = tenant.id
        if (!tenant.businessId) {
          await prismaClient.tenant.update({
            where: { id: tenant.id },
            data: { businessId: business.id },
          })
        }
      }
    }

    if (primaryRoomName) {
      await prismaClient.messageChannel.updateMany({
        where: { roomName: primaryRoomName },
        data: {
          businessId: business.id,
          ...(resolvedTenantId ? { tenantId: resolvedTenantId } : {}),
        },
      })
    }

    revalidatePath('/messages')
    if (primaryRoomName) {
      revalidatePath(`/messages/${primaryRoomName}`)
    }
    return { ok: true, data: { id: business.id, primaryRoomName } }
  } catch (error) {
    console.error('createBusiness error', error)
    return { ok: false, error: 'Failed to create business' }
  }
}

export async function updateBusiness(
  businessId: string,
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

  const existing = await prismaClient.business.findFirst({
    where: { id: businessId, userId: user.id },
  })
  if (!existing) return { ok: false, error: 'Business not found' }
  if (data.tenantId) {
    const tenant = await prismaClient.tenant.findFirst({
      where: { id: data.tenantId, userId: user.id },
      select: { id: true },
    })
    if (!tenant) return { ok: false, error: 'Tenant not found' }
  }

  try {
    await prismaClient.business.update({
      where: { id: businessId },
      data: {
        name: data.name?.trim() || undefined,
        description: data.description?.trim() ?? undefined,
      },
    })

    if (data.agentIds) {
      await prismaClient.businessAgent.deleteMany({ where: { businessId } })
      if (data.agentIds.length > 0) {
        await prismaClient.businessAgent.createMany({
          data: data.agentIds.map((agentId) => ({
            businessId,
            agentId,
            isPrimary: agentId === (data.primaryAgentId || data.agentIds![0]),
          })),
        })
      }
    }

    if (data.productIds) {
      await prismaClient.businessProduct.deleteMany({ where: { businessId } })
      if (data.productIds.length > 0) {
        await prismaClient.businessProduct.createMany({
          data: data.productIds.map((webinarId) => ({
            businessId,
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
          businessId,
          ...(data.tenantId !== undefined ? { tenantId: data.tenantId } : {}),
        },
      })
      revalidatePath(`/messages/${primaryRoomName}`)
    }

    revalidatePath('/messages')
    return { ok: true }
  } catch (error) {
    console.error('updateBusiness error', error)
    return { ok: false, error: 'Failed to update business' }
  }
}

/**
 * Minimal lookup for Home AI preview only — avoids loading every business, product, and webinar.
 */
export async function getHomePrimaryAgentRoomName(): Promise<string | null> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return null

  const user = await prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!user) return null

  const business = await prismaClient.business.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      agents: {
        orderBy: { isPrimary: 'desc' },
        take: 1,
        select: {
          agent: { select: { roomName: true } },
        },
      },
    },
  })

  return business?.agents[0]?.agent.roomName ?? null
}

export async function getBusinesses() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return []

  const user = await prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!user) return []

  return prismaClient.business.findMany({
    where: { userId: user.id },
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
      _count: { select: { channels: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getBusinessByRoomName(roomName: string) {
  const agent = await prismaClient.liveKitAgent.findUnique({
    where: { roomName },
    select: { id: true },
  })
  if (!agent) return null

  const link = await prismaClient.businessAgent.findFirst({
    where: { agentId: agent.id },
    include: {
      business: {
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

  return link?.business || null
}

export async function deleteBusiness(businessId: string): Promise<ActionResult> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return { ok: false, error: 'UNAUTHENTICATED' }

  const user = await prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!user) return { ok: false, error: 'User not found' }

  try {
    await prismaClient.business.deleteMany({
      where: { id: businessId, userId: user.id },
    })

    revalidatePath('/messages')
    revalidatePath('/tenants')
    revalidatePath('/tenants/business-profile')
    return { ok: true }
  } catch (error) {
    console.error('deleteBusiness error', error)
    return { ok: false, error: 'Failed to delete business' }
  }
}
