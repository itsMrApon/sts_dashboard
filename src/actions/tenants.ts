'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath, unstable_cache } from 'next/cache'
import { prismaClient } from '@/lib/prismaClient'
import { VideoType } from '@prisma/client'
import { onAuthenticateUser } from './auth'

export async function createTenant(data: {
  name: string
  businessId?: string
  webinarId?: string
  pitchMessage: string
  videoUrl?: string
  videoType?: string
}) {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'UNAUTHENTICATED' }

  const user = await prismaClient.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  })
  if (!user) return { success: false, error: 'User not found' }

  if (data.businessId) {
    const biz = await prismaClient.business.findFirst({
      where: { id: data.businessId, userId: user.id },
      select: { id: true },
    })
    if (!biz) return { success: false, error: 'Business not found' }
  }

  const tenant = await prismaClient.tenant.create({
    data: {
      userId: user.id,
      businessId: data.businessId || null,
      name: data.name,
      webinarId: data.webinarId || null,
      pitchMessage: data.pitchMessage,
      videoUrl: data.videoUrl || null,
      videoType: (data.videoType as VideoType) || 'LINK',
    },
  })

  revalidatePath('/tenants')
  return { success: true, tenant }
}

export async function updateTenant(
  tenantId: string,
  data: {
    name?: string
    pitchMessage?: string
    videoUrl?: string
    videoType?: string
    businessId?: string | null
    webinarId?: string | null
  },
) {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'UNAUTHENTICATED' }

  const user = await prismaClient.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  })
  if (!user) return { success: false, error: 'User not found' }

  const existing = await prismaClient.tenant.findFirst({
    where: { id: tenantId, userId: user.id },
  })
  if (!existing) return { success: false, error: 'Tenant not found' }

  if (data.businessId) {
    const biz = await prismaClient.business.findFirst({
      where: { id: data.businessId, userId: user.id },
      select: { id: true },
    })
    if (!biz) return { success: false, error: 'Business not found' }
  }

  const tenant = await prismaClient.tenant.update({
    where: { id: tenantId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.pitchMessage !== undefined && { pitchMessage: data.pitchMessage }),
      ...(data.videoUrl !== undefined && { videoUrl: data.videoUrl }),
      ...(data.videoType !== undefined && { videoType: data.videoType as VideoType }),
      ...(data.businessId !== undefined && { businessId: data.businessId }),
      ...(data.webinarId !== undefined && { webinarId: data.webinarId }),
    },
  })

  revalidatePath('/tenants')
  revalidatePath(`/tenants/${tenantId}`)
  return { success: true, tenant }
}

const getTenantsCached = unstable_cache(
  async (userId: string) =>
    prismaClient.tenant.findMany({
      where: { userId },
      include: {
        business: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ['tenants-list'],
  { revalidate: 10 },
)

export async function getTenants(resolvedUserId?: string) {
  let userId = resolvedUserId
  if (!userId) {
    const authResult = await onAuthenticateUser()
    if (!authResult.user) return []
    userId = authResult.user.id
  }

  return getTenantsCached(userId)
}

export async function getTenantById(tenantId: string) {
  const { userId } = await auth()
  if (!userId) return null

  const user = await prismaClient.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  })
  if (!user) return null

  return prismaClient.tenant.findFirst({
    where: { id: tenantId, userId: user.id },
    include: {
      business: true,
    },
  })
}

export async function deleteTenant(tenantId: string) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return { success: false, error: 'UNAUTHENTICATED' }

  const user = await prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!user) return { success: false, error: 'User not found' }

  try {
    await prismaClient.tenant.deleteMany({
      where: { id: tenantId, userId: user.id },
    })

    revalidatePath('/tenants')
    return { success: true }
  } catch (error) {
    console.error('deleteTenant error', error)
    return { success: false, error: 'Failed to delete tenant' }
  }
}

/** Optional: POST business-shaped context to n8n for manual workflows. */
export async function pushTenantContextToN8n(tenantId: string) {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'UNAUTHENTICATED' }

  const user = await prismaClient.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  })
  if (!user) return { success: false, error: 'User not found' }

  const webhookUrl =
    process.env.N8N_TENANT_WEBHOOK_URL || process.env.N8N_CAMPAIGN_WEBHOOK_URL
  if (!webhookUrl) {
    return { success: false, error: 'N8N_TENANT_WEBHOOK_URL not configured' }
  }

  const tenant = await prismaClient.tenant.findFirst({
    where: { id: tenantId, userId: user.id },
    include: { business: true },
  })
  if (!tenant) return { success: false, error: 'Tenant not found' }

  try {
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: tenant.id,
        userId: user.id,
        businessId: tenant.businessId,
        business: tenant.business
          ? {
              name: tenant.business.name,
              description: tenant.business.description,
              logo: tenant.business.logo,
            }
          : null,
        tenant: {
          name: tenant.name,
          pitchMessage: tenant.pitchMessage,
          videoUrl: tenant.videoUrl,
          webinarId: tenant.webinarId,
        },
      }),
    })
    if (!resp.ok) {
      throw new Error(`n8n responded with ${resp.status}`)
    }
  } catch {
    return { success: false, error: 'Webhook request failed' }
  }

  return { success: true }
}
