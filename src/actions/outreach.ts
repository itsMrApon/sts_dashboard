'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { prismaClient } from '@/lib/prismaClient'
import { encryptToken } from '@/lib/messages/encrypt'
import { ChannelStatus, OutreachPlatform, Prisma } from '@prisma/client'
import { onAuthenticateUser } from './auth'

type ActionResult =
  | { ok: true }
  | { ok: false; error: string }

export async function connectOutreachChannel(
  platform: OutreachPlatform,
  credentials: Record<string, string>,
  label: string,
  pageUrl?: string,
  publishProfileId?: string,
): Promise<ActionResult> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return { ok: false, error: 'UNAUTHENTICATED' }

  const user = await prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!user) return { ok: false, error: 'User not found' }

  if (!label.trim()) return { ok: false, error: 'Account label is required' }

  if (!publishProfileId) return { ok: false, error: 'Publish profile is required' }
  const biz = await prismaClient.publishProfile.findFirst({
    where: { id: publishProfileId, userId: user.id },
    select: { id: true },
  })
  if (!biz) return { ok: false, error: 'Business not found' }

  try {
    const encrypted: Record<string, string> = {}
    for (const [key, value] of Object.entries(credentials)) {
      if (value) encrypted[key] = encryptToken(value)
    }

    await prismaClient.outreachChannel.create({
      data: {
        userId: user.id,
        publishProfileId,
        platform,
        credentials:
          Object.keys(encrypted).length > 0 ? encrypted : Prisma.DbNull,
        accountLabel: label.trim(),
        pageUrl: pageUrl?.trim() || null,
        status: ChannelStatus.ACTIVE,
      },
    })

    revalidatePath('/tenants/publish')
    revalidatePath('/tenants/publish')
    return { ok: true }
  } catch (error) {
    console.error(`connectOutreach[${platform}] error`, error)
    return { ok: false, error: `Failed to connect ${platform}` }
  }
}

export async function disconnectOutreachChannel(
  channelId: string,
): Promise<ActionResult> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return { ok: false, error: 'UNAUTHENTICATED' }

  const user = await prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!user) return { ok: false, error: 'User not found' }

  try {
    await prismaClient.outreachChannel.deleteMany({
      where: { id: channelId, userId: user.id },
    })

    revalidatePath('/tenants/publish')
    revalidatePath('/tenants/publish')
    return { ok: true }
  } catch (error) {
    console.error(`disconnectOutreach error`, error)
    return { ok: false, error: 'Failed to disconnect' }
  }
}

export async function getOutreachChannels(
  publishProfileId?: string | null,
  resolvedUserId?: string,
) {
  let userId = resolvedUserId
  if (!userId) {
    const authResult = await onAuthenticateUser()
    if (!authResult.user) return []
    userId = authResult.user.id
  }

  if (!publishProfileId) return []

  return prismaClient.outreachChannel.findMany({
    where: {
      userId,
      publishProfileId,
    },
    select: {
      id: true,
      platform: true,
      status: true,
      accountLabel: true,
      pageUrl: true,
      publishProfileId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })
}
