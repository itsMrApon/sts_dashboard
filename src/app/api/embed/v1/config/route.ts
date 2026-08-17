import { NextRequest, NextResponse } from 'next/server'
import { onAuthenticateUser } from '@/actions/auth'
import { prismaClient } from '@/lib/prismaClient'
import { verifyRoomOwnership } from '@/lib/messages/verifyRoomOwnership'
import { normalizeOrigins } from '@/lib/embed/origin'
import { generateSiteKey, hashSiteKey } from '@/lib/embed/siteKey'

async function requireRoomOwner(roomName: string) {
  const auth = await onAuthenticateUser()
  if (!auth.user || (auth.status !== 200 && auth.status !== 201)) {
    return { error: NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 }) }
  }

  const ownership = await verifyRoomOwnership(roomName, {
    id: auth.user.id,
    clerkId: auth.user.clerkId,
  })
  if (!ownership.ok) {
    return {
      error: NextResponse.json(
        { error: ownership.reason === 'UNAUTHENTICATED' ? 'UNAUTHENTICATED' : 'FORBIDDEN' },
        { status: ownership.reason === 'UNAUTHENTICATED' ? 401 : 403 },
      ),
    }
  }

  const channel = await prismaClient.messageChannel.findFirst({
    where: { roomName },
    orderBy: { updatedAt: 'desc' },
    select: { workspaceId: true, publishProfileId: true },
  })

  let workspaceId = channel?.workspaceId ?? null
  let publishProfileId = channel?.publishProfileId?? null

  if (!publishProfileId || !workspaceId) {
    const agent = await prismaClient.liveKitAgent.findUnique({
      where: { roomName },
      select: { id: true },
    })
    if (agent) {
      const link = await prismaClient.publishAgent.findFirst({
        where: { agentId: agent.id },
        select: { publishProfileId: true },
      })
      if (!publishProfileId && link?.publishProfileId) {
        publishProfileId = link.publishProfileId
      }
      if (!workspaceId && publishProfileId) {
        const workspace = await prismaClient.workspace.findFirst({
          where: { publishProfileId },
          orderBy: { publishedAt: 'desc' },
          select: { id: true },
        })
        workspaceId = workspace?.id ?? null
      }
    }
  }

  return {
    userId: auth.user.id,
    workspaceId,
    tenantId: workspaceId,
    publishProfileId,
  }
}

export async function GET(request: NextRequest) {
  const roomName = request.nextUrl.searchParams.get('roomName')?.trim()
  if (!roomName) {
    return NextResponse.json({ error: 'roomName is required' }, { status: 400 })
  }

  const gate = await requireRoomOwner(roomName)
  if ('error' in gate) return gate.error

  const config = await prismaClient.roomEmbedConfig.findUnique({
    where: { roomName },
  })

  if (!config) {
    return NextResponse.json({
      roomName,
      configured: false,
      enabled: false,
      allowedOrigins: [],
      siteKeyPrefix: null,
      workspaceId: gate.workspaceId,
      publishProfileId: gate.publishProfileId,
    })
  }

  return NextResponse.json({
    roomName,
    configured: true,
    enabled: config.enabled,
    allowedOrigins: config.allowedOrigins,
    siteKeyPrefix: config.siteKeyPrefix,
    publishProfileId: config.publishProfileId ?? gate.publishProfileId,
    workspaceId: config.workspaceId ?? gate.workspaceId,
    rotatedAt: config.rotatedAt,
    updatedAt: config.updatedAt,
  })
}

export async function PUT(request: NextRequest) {
  const body = (await request.json()) as {
    roomName?: string
    allowedOrigins?: string[]
    enabled?: boolean
  }

  const roomName = body.roomName?.trim()
  if (!roomName) {
    return NextResponse.json({ error: 'roomName is required' }, { status: 400 })
  }

  const gate = await requireRoomOwner(roomName)
  if ('error' in gate) return gate.error

  const allowedOrigins = normalizeOrigins(body.allowedOrigins ?? [])
  const enabled = body.enabled !== false

  const existing = await prismaClient.roomEmbedConfig.findUnique({
    where: { roomName },
  })

  if (existing) {
    const updated = await prismaClient.roomEmbedConfig.update({
      where: { roomName },
      data: {
        allowedOrigins,
        enabled,
        publishProfileId: gate.publishProfileId?? existing.publishProfileId,
        workspaceId: gate.workspaceId ?? existing.workspaceId,
      },
    })
    return NextResponse.json({
      roomName,
      configured: true,
      enabled: updated.enabled,
      allowedOrigins: updated.allowedOrigins,
      siteKeyPrefix: updated.siteKeyPrefix,
      publishProfileId: updated.publishProfileId,
    })
  }

  const siteKey = generateSiteKey()
  const created = await prismaClient.roomEmbedConfig.create({
    data: {
      roomName,
      userId: gate.userId,
      workspaceId: gate.workspaceId,
      publishProfileId: gate.publishProfileId,
      allowedOrigins,
      enabled,
      siteKeyHash: hashSiteKey(siteKey),
      siteKeyPrefix: siteKey.slice(0, 20),
    },
  })

  return NextResponse.json({
    roomName,
    configured: true,
    enabled: created.enabled,
    allowedOrigins: created.allowedOrigins,
    siteKeyPrefix: created.siteKeyPrefix,
    publishProfileId: created.publishProfileId,
    siteKey,
    siteKeyShownOnce: true,
  })
}
