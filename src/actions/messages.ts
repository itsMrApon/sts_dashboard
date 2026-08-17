'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { prismaClient } from '@/lib/prismaClient'
import { encryptToken, decryptToken } from '@/lib/messages/encrypt'
import { verifyRoomOwnership } from '@/lib/messages/verifyRoomOwnership'
import { ChannelStatus, Platform, Prisma } from '@prisma/client'

type ActionResult =
  | { ok: true }
  | { ok: false; error: string }

type PlatformCredentials = Record<string, string>

const SUPPORTED_PLATFORMS: Platform[] = [
  'TELEGRAM',
  'DISCORD',
  'WHATSAPP',
  'YOUTUBE',
  'FACEBOOK_MESSENGER',
  'INSTAGRAM',
  'TIKTOK',
]

function revalidateMessagingSurfaces(roomName: string) {
  revalidatePath('/messages')
  revalidatePath('/messages/connections')
  revalidatePath(`/messages/${roomName}`)
}

export async function connectPlatform(
  roomName: string,
  platform: Platform,
  credentials: PlatformCredentials,
  label?: string,
): Promise<ActionResult> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return { ok: false, error: 'UNAUTHENTICATED' }

  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    return { ok: false, error: 'Unsupported platform' }
  }

  const ownership = await verifyRoomOwnership(roomName)
  if (!ownership.ok) return { ok: false, error: ownership.reason }

  const user = await prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })

  try {
    const encrypted: PlatformCredentials = {}
    for (const [key, value] of Object.entries(credentials)) {
      encrypted[key] = encryptToken(value)
    }

    await prismaClient.messageChannel.upsert({
      where: {
        roomName_platform: { roomName, platform },
      },
      update: {
        credentials: encrypted,
        accountLabel: label || null,
        status: ChannelStatus.ACTIVE,
        userId: user?.id || null,
      },
      create: {
        roomName,
        platform,
        credentials: encrypted,
        accountLabel: label || null,
        status: ChannelStatus.ACTIVE,
        userId: user?.id || null,
      },
    })

    revalidateMessagingSurfaces(roomName)
    return { ok: true }
  } catch (error) {
    console.error(`connect${platform} error`, error)
    return { ok: false, error: `Failed to connect ${platform}` }
  }
}

export async function disconnectPlatform(
  roomName: string,
  platform: Platform,
): Promise<ActionResult> {
  const { userId } = await auth()
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' }

  const ownership = await verifyRoomOwnership(roomName)
  if (!ownership.ok) return { ok: false, error: ownership.reason }

  try {
    await prismaClient.messageChannel.updateMany({
      where: { roomName, platform },
      data: { status: ChannelStatus.INACTIVE, credentials: Prisma.DbNull },
    })

    revalidateMessagingSurfaces(roomName)
    return { ok: true }
  } catch (error) {
    console.error(`disconnect${platform} error`, error)
    return { ok: false, error: `Failed to disconnect ${platform}` }
  }
}

export async function getConnectedPlatforms(roomName: string) {
  const channels = await prismaClient.messageChannel.findMany({
    where: { roomName, status: ChannelStatus.ACTIVE },
    select: { platform: true, accountLabel: true },
  })
  return channels
}

export async function connectTelegram(roomName: string, botToken: string): Promise<ActionResult> {
  const { userId } = await auth()
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' }

  const ownership = await verifyRoomOwnership(roomName)
  if (!ownership.ok) return { ok: false, error: ownership.reason }

  const apiKey = process.env.SAAS_API_KEY
  if (!apiKey) return { ok: false, error: 'SAAS_API_KEY not configured' }

  try {
    const encryptedToken = encryptToken(botToken)

    const webhookBase = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL
    if (!webhookBase) {
      return { ok: false, error: 'Webhook base URL not configured' }
    }

    const webhookUrl = `${webhookBase.replace(/\/$/, '')}/api/webhook/telegram/${encodeURIComponent(
      roomName,
    )}`

    // Set Telegram webhook
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message'] }),
    })
    const data = (await resp.json()) as { ok?: boolean; description?: string }
    if (!data.ok) {
      return { ok: false, error: data.description || 'Failed to set Telegram webhook' }
    }

    const meResp = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
    const meJson = (await meResp.json()) as { ok?: boolean; result?: { username?: string } }
    const username = meJson.ok ? meJson.result?.username : undefined

    await prismaClient.messageChannel.upsert({
      where: {
        roomName_platform: {
          roomName,
          platform: Platform.TELEGRAM,
        },
      },
      update: {
        telegramBotToken: encryptedToken,
        telegramBotUsername: username,
        telegramWebhookSet: true,
        status: ChannelStatus.ACTIVE,
      },
      create: {
        roomName,
        platform: Platform.TELEGRAM,
        status: ChannelStatus.ACTIVE,
        telegramBotToken: encryptedToken,
        telegramBotUsername: username,
        telegramWebhookSet: true,
      },
    })

    revalidateMessagingSurfaces(roomName)

    return { ok: true }
  } catch (error) {
    console.error('connectTelegram error', error)
    return { ok: false, error: 'Failed to connect Telegram' }
  }
}

export async function disconnectTelegram(roomName: string): Promise<ActionResult> {
  const { userId } = await auth()
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' }

  const ownership = await verifyRoomOwnership(roomName)
  if (!ownership.ok) return { ok: false, error: ownership.reason }

  try {
    const channel = await prismaClient.messageChannel.findUnique({
      where: {
        roomName_platform: {
          roomName,
          platform: Platform.TELEGRAM,
        },
      },
    })

    if (channel?.telegramBotToken) {
      const token = decryptToken(channel.telegramBotToken)
      if (token) {
        try {
          await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
            method: 'POST',
          })
        } catch (err) {
          console.error('Failed to delete Telegram webhook', err)
        }
      }
    }

    await prismaClient.messageChannel.updateMany({
      where: {
        roomName,
        platform: Platform.TELEGRAM,
      },
      data: {
        status: ChannelStatus.INACTIVE,
        telegramWebhookSet: false,
      },
    })

    revalidateMessagingSurfaces(roomName)

    return { ok: true }
  } catch (error) {
    console.error('disconnectTelegram error', error)
    return { ok: false, error: 'Failed to disconnect Telegram' }
  }
}

export async function connectDiscord(
  roomName: string,
  botToken: string,
  publicKey: string,
): Promise<ActionResult> {
  const { userId } = await auth()
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' }

  const ownership = await verifyRoomOwnership(roomName)
  if (!ownership.ok) return { ok: false, error: ownership.reason }

  try {
    const encryptedToken = encryptToken(botToken)

    await prismaClient.messageChannel.upsert({
      where: {
        roomName_platform: {
          roomName,
          platform: Platform.DISCORD,
        },
      },
      update: {
        discordBotToken: encryptedToken,
        discordPublicKey: publicKey,
        status: ChannelStatus.ACTIVE,
      },
      create: {
        roomName,
        platform: Platform.DISCORD,
        status: ChannelStatus.ACTIVE,
        discordBotToken: encryptedToken,
        discordPublicKey: publicKey,
      },
    })

    revalidateMessagingSurfaces(roomName)
    return { ok: true }
  } catch (error) {
    console.error('connectDiscord error', error)
    return { ok: false, error: 'Failed to connect Discord' }
  }
}

export async function disconnectDiscord(roomName: string): Promise<ActionResult> {
  const { userId } = await auth()
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' }

  const ownership = await verifyRoomOwnership(roomName)
  if (!ownership.ok) return { ok: false, error: ownership.reason }

  try {
    await prismaClient.messageChannel.updateMany({
      where: {
        roomName,
        platform: Platform.DISCORD,
      },
      data: {
        status: ChannelStatus.INACTIVE,
      },
    })

    revalidateMessagingSurfaces(roomName)
    return { ok: true }
  } catch (error) {
    console.error('disconnectDiscord error', error)
    return { ok: false, error: 'Failed to disconnect Discord' }
  }
}

export async function connectSlack(
  roomName: string,
  botToken: string,
  teamId: string,
): Promise<ActionResult> {
  const { userId } = await auth()
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' }

  const ownership = await verifyRoomOwnership(roomName)
  if (!ownership.ok) return { ok: false, error: ownership.reason }

  try {
    const res = await fetch('https://slack.com/api/auth.test', {
      headers: { Authorization: `Bearer ${botToken}` },
    })
    const data = (await res.json()) as { ok?: boolean; error?: string }
    if (!data.ok) {
      return { ok: false, error: data.error || 'Invalid Slack bot token' }
    }

    const encrypted = encryptToken(botToken)

    await prismaClient.messageChannel.upsert({
      where: { roomName_platform: { roomName, platform: Platform.SLACK } },
      create: {
        roomName,
        platform: Platform.SLACK,
        slackBotToken: encrypted,
        slackTeamId: teamId || null,
        status: ChannelStatus.ACTIVE,
      },
      update: {
        slackBotToken: encrypted,
        slackTeamId: teamId || null,
        status: ChannelStatus.ACTIVE,
      },
    })

    revalidateMessagingSurfaces(roomName)
    return { ok: true }
  } catch (error) {
    console.error('connectSlack error', error)
    return { ok: false, error: 'Failed to connect Slack' }
  }
}

export async function disconnectSlack(roomName: string): Promise<ActionResult> {
  const { userId } = await auth()
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' }

  const ownership = await verifyRoomOwnership(roomName)
  if (!ownership.ok) return { ok: false, error: ownership.reason }

  try {
    await prismaClient.messageChannel.updateMany({
      where: { roomName, platform: Platform.SLACK },
      data: {
        status: ChannelStatus.INACTIVE,
        slackBotToken: null,
        slackTeamId: null,
      },
    })

    revalidateMessagingSurfaces(roomName)
    return { ok: true }
  } catch (error) {
    console.error('disconnectSlack error', error)
    return { ok: false, error: 'Failed to disconnect Slack' }
  }
}

/**
 * Attach or move a messaging room to a workspace.
 * Option A: workspace is required — null/empty is rejected (no orphan rooms).
 */
export async function updateChannelWorkspace(
  roomName: string,
  workspaceId: string,
): Promise<ActionResult> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return { ok: false, error: 'UNAUTHENTICATED' }

  const trimmed = workspaceId?.trim()
  if (!trimmed) {
    return {
      ok: false,
      error: 'A workspace is required. Change workspace or delete the room instead.',
    }
  }

  const ownership = await verifyRoomOwnership(roomName)
  if (!ownership.ok) return { ok: false, error: ownership.reason }

  const user = await prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!user) return { ok: false, error: 'User not found' }

  const workspace = await prismaClient.workspace.findFirst({
    where: { id: trimmed, userId: user.id },
    select: { id: true, publishProfileId: true },
  })
  if (!workspace) return { ok: false, error: 'Workspace not found' }

  try {
    const updated = await prismaClient.messageChannel.updateMany({
      where: { roomName },
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        ...(workspace.publishProfileId? { publishProfileId: workspace.publishProfileId } : {}),
      },
    })

    if (updated.count === 0) {
      await prismaClient.messageChannel.create({
        data: {
          roomName,
          platform: 'WHATSAPP',
          status: 'INACTIVE',
          userId: user.id,
          workspaceId: workspace.id,
          publishProfileId: workspace.publishProfileId,
          accountLabel: 'Workspace link',
        },
      })
    }

    // Keep publish hub ↔ workspace in sync when attaching
    if (workspace.publishProfileId) {
      // no-op: workspace already owns publishProfileId
    } else {
      const channelBiz = await prismaClient.messageChannel.findFirst({
        where: { roomName, publishProfileId: { not: null } },
        select: { publishProfileId: true },
      })
      if (channelBiz?.publishProfileId) {
        await prismaClient.workspace.update({
          where: { id: workspace.id },
          data: { publishProfileId: channelBiz.publishProfileId },
        })
      }
    }

    revalidateMessagingSurfaces(roomName)
    return { ok: true }
  } catch (error) {
    console.error('updateChannelWorkspace error', error)
    return { ok: false, error: 'Failed to update workspace link' }
  }
}

/** @deprecated Use updateChannelWorkspace — null unlink is no longer allowed (Option A). */
export async function updateChannelTenant(
  roomName: string,
  tenantId: string | null,
): Promise<ActionResult> {
  if (!tenantId) {
    return {
      ok: false,
      error: 'A workspace is required. Change workspace or delete the room instead.',
    }
  }
  return updateChannelWorkspace(roomName, tenantId)
}

/**
 * Removes all message channels for this room and unlinks the agent from your businesses.
 * Does not delete the LiveKit agent or Business rows — use New room to reconnect.
 */
export async function removeMessagingRoom(roomName: string): Promise<ActionResult> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return { ok: false, error: 'UNAUTHENTICATED' }

  const user = await prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!user) return { ok: false, error: 'User not found' }

  const ownership = await verifyRoomOwnership(roomName)
  if (!ownership.ok) return { ok: false, error: ownership.reason }

  try {
    await prismaClient.$transaction([
      prismaClient.messageChannel.deleteMany({
        where: {
          roomName,
          OR: [{ userId: user.id }, { publishProfile: { userId: user.id } }],
        },
      }),
      prismaClient.publishAgent.deleteMany({
        where: {
          agent: { roomName },
          publishProfile: { userId: user.id },
        },
      }),
    ])

    revalidateMessagingSurfaces(roomName)
    return { ok: true }
  } catch (error) {
    console.error('removeMessagingRoom error', error)
    return { ok: false, error: 'Failed to remove messaging room' }
  }
}

