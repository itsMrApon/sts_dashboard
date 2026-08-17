import { NextRequest, NextResponse } from 'next/server'
import { onAuthenticateUser } from '@/actions/auth'
import { prismaClient } from '@/lib/prismaClient'
import { verifyRoomOwnership } from '@/lib/messages/verifyRoomOwnership'
import { generateSiteKey, hashSiteKey } from '@/lib/embed/siteKey'

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { roomName?: string }
  const roomName = body.roomName?.trim()
  if (!roomName) {
    return NextResponse.json({ error: 'roomName is required' }, { status: 400 })
  }

  const auth = await onAuthenticateUser()
  if (!auth.user || (auth.status !== 200 && auth.status !== 201)) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  }

  const ownership = await verifyRoomOwnership(roomName, {
    id: auth.user.id,
    clerkId: auth.user.clerkId,
  })
  if (!ownership.ok) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const existing = await prismaClient.roomEmbedConfig.findUnique({
    where: { roomName },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Configure embed settings before rotating the key.' }, { status: 404 })
  }

  const siteKey = generateSiteKey()
  const updated = await prismaClient.roomEmbedConfig.update({
    where: { roomName },
    data: {
      siteKeyHash: hashSiteKey(siteKey),
      siteKeyPrefix: siteKey.slice(0, 20),
      rotatedAt: new Date(),
    },
  })

  return NextResponse.json({
    roomName,
    siteKey,
    siteKeyPrefix: updated.siteKeyPrefix,
    rotatedAt: updated.rotatedAt,
    siteKeyShownOnce: true,
  })
}
