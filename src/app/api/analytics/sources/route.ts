import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getConversionBySource } from '@/lib/leads/analytics'

export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json([], { status: 401 })
  }

  const userIdParam = req.nextUrl.searchParams.get('userId')
  if (!userIdParam) {
    return NextResponse.json([], { status: 400 })
  }

  const data = await getConversionBySource(userIdParam)
  return NextResponse.json(data, { status: 200 })
}
