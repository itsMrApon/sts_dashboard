import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prismaClient } from '@/lib/prismaClient'
import { ChannelStatus } from '@prisma/client'

export async function GET() {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ active: false, platforms: [] }, { status: 401 })
  }

  const user = await prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })

  const channels = await prismaClient.messageChannel.findMany({
    where: {
      status: ChannelStatus.ACTIVE,
      ...(user ? { userId: user.id } : {}),
    },
    select: { platform: true, accountLabel: true, roomName: true },
  })

  const platforms = channels.map((c) => c.platform)
  const hasTelegram = platforms.includes('TELEGRAM')

  return NextResponse.json({
    active: hasTelegram,
    platforms: [...new Set(platforms)],
    channels,
  }, { status: 200 })
}
