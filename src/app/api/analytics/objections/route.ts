import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prismaClient } from '@/lib/prismaClient'
import { getTopObjections } from '@/lib/leads/analytics'
import { withRouteErrors } from '@/lib/http/routeErrors'

export const GET = withRouteErrors('api/analytics/objections', async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json([], { status: 401 })
  }

  const user = await prismaClient.user.findUnique({ where: { clerkId }, select: { id: true } })
  if (!user) {
    return NextResponse.json([], { status: 404 })
  }

  // Analytics are always scoped to the signed-in user; a userId param may only name yourself.
  const userIdParam = req.nextUrl.searchParams.get('userId')
  if (userIdParam && userIdParam !== user.id) {
    return NextResponse.json([], { status: 403 })
  }

  const data = await getTopObjections(user.id)
  return NextResponse.json(data, { status: 200 })
})
