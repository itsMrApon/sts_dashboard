import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prismaClient } from '@/lib/prismaClient'

export async function GET() {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json([], { status: 401 })
  }

  const user = await prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!user) return NextResponse.json([])

  const tenants = await prismaClient.tenant.findMany({
    where: { userId: user.id },
    select: { id: true, name: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(tenants)
}
