import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prismaClient } from '@/lib/prismaClient'
import { ChannelStatus } from '@prisma/client'

export async function GET() {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ platforms: [], channels: [] }, { status: 401 })
  }

  const user = await prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!user) {
    return NextResponse.json({ platforms: [], channels: [] }, { status: 200 })
  }

  const channels = await prismaClient.outreachChannel.findMany({
    where: { userId: user.id, status: ChannelStatus.ACTIVE },
    select: { id: true, platform: true, accountLabel: true, pageUrl: true },
  })

  const uniquePlatforms = [...new Set(channels.map((c) => c.platform))]

  return NextResponse.json({
    platforms: uniquePlatforms,
    channels,
  }, { status: 200 })
}
