import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prismaClient } from '@/lib/prismaClient'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json([], { status: 401 })
  }

  const user = await prismaClient.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  })
  if (!user) {
    return NextResponse.json([], { status: 404 })
  }

  const webinars = await prismaClient.webinar.findMany({
    where: { presenterId: user.id },
    select: { id: true, title: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(webinars, { status: 200 })
}
