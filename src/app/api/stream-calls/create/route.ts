import { NextResponse } from 'next/server'
import { buildAgentContext } from '@/lib/messages/buildAgentContext'
import { prismaClient } from '@/lib/prismaClient'
import { createOrGetStream1to1Call, getTokenForGuest, getTokenForHost } from '@/actions/streamIo'

function extractWebinarIdFromUrl(url: string): string | null {
  const trimmed = url.trim().replace(/\/+$/, '')
  const parts = trimmed.split('/').filter(Boolean)
  const last = parts[parts.length - 1] || null
  if (!last) return null

  const uuidLike = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
  return uuidLike.test(last) ? last : null
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      roomName?: string
      sessionId?: string
      attendeeIdentity?: string
      attendeeName?: string
    }

    const roomName = body.roomName
    const sessionId = body.sessionId
    if (!roomName || !sessionId) {
      return NextResponse.json(
        { error: 'roomName and sessionId required' },
        { status: 400 },
      )
    }

    const context = await buildAgentContext(roomName)
    const primaryProductUrl = context.roomJoinLink || context.productLinks?.[0]?.url
    if (!primaryProductUrl) {
      return NextResponse.json(
        { error: 'No linked product/webinar found for this room' },
        { status: 404 },
      )
    }

    const webinarId = extractWebinarIdFromUrl(primaryProductUrl)
    if (!webinarId) {
      return NextResponse.json(
        { error: 'Could not parse webinarId from linked product URL' },
        { status: 400 },
      )
    }

    const webinar = await prismaClient.webinar.findUnique({
      where: { id: webinarId },
      select: {
        id: true,
        presenterId: true,
        presenter: { select: { id: true, name: true, profileImage: true } },
      },
    })

    if (!webinar || !webinar.presenterId) {
      return NextResponse.json({ error: 'Webinar not found' }, { status: 404 })
    }

    const attendeeIdentityRaw = body.attendeeIdentity || sessionId
    const attendeeIdentity = attendeeIdentityRaw.replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 64)
    const attendeeUserId = `guest-${attendeeIdentity}`
    const attendeeName = (body.attendeeName || 'Guest').slice(0, 100)
    const callId = `${webinar.id}-${attendeeIdentity}`

    await prismaClient.streamCallSession.upsert({
      where: { callId },
      create: {
        roomName,
        webinarId: webinar.id,
        callId,
        hostUserId: webinar.presenterId,
        attendeeUserId,
        attendeeIdentity,
        status: 'ACTIVE',
      },
      update: {
        status: 'ACTIVE',
      },
    })

    // IMPORTANT: create/getOrCreate requires both users to exist.
    // We upsert users before create/getOrCreate to avoid Stream error "users don't exist".
    await getTokenForHost(
      webinar.presenterId,
      webinar.presenter?.name ?? 'Host',
      webinar.presenter?.profileImage ?? '',
    )
    const attendeeToken = await getTokenForGuest(attendeeUserId, attendeeName)

    await createOrGetStream1to1Call({
      callId,
      hostUserId: webinar.presenterId,
      attendeeUserId,
    })

    const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing NEXT_PUBLIC_STREAM_API_KEY' },
        { status: 500 },
      )
    }

    const attendeeImage = `https://api.dicebear.com/7.x/initials/svg?seed=${attendeeName || 'Guest'}`

    return NextResponse.json({
      callType: 'livestream',
      callId,
      apiKey,
      attendee: { id: attendeeUserId, name: attendeeName, image: attendeeImage },
      attendeeToken,
    })
  } catch (error) {
    console.error('[stream-call-create]', error)
    return NextResponse.json(
      { error: 'Failed to create stream call' },
      { status: 500 },
    )
  }
}

