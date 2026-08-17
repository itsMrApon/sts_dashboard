import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prismaClient } from '@/lib/prismaClient'
import {
  buildGoogleCalendarAuthUrl,
  resolveGoogleOAuthCredentials,
} from '@/lib/leads/googleCalendar'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  const user = await prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const oauth = await resolveGoogleOAuthCredentials(user.id)
  if (!oauth) {
    return NextResponse.redirect(
      new URL('/lead?gcal=missing_oauth', req.url),
    )
  }

  const origin = new URL(req.url).origin
  const state = Buffer.from(
    JSON.stringify({ userId: user.id, ts: Date.now() }),
  ).toString('base64url')

  const url = buildGoogleCalendarAuthUrl({
    origin,
    state,
    clientId: oauth.clientId,
  })
  return NextResponse.redirect(url)
}
