import { NextResponse } from 'next/server'
import { prismaClient } from '@/lib/prismaClient'
import { EMBED_DAILY_QUOTAS, EMBED_RATE_LIMITS } from '@/lib/embed/rateLimit'
import {
  embedOptions,
  guardEmbedRequest,
  jsonWithCors,
} from '@/lib/embed/embedRouteGuard'
import { resolveRoomOwnerUserId } from '@/lib/messages/resolveRoomOwnerUserId'
import { canSendEmail, sendPlainEmail } from '@/lib/email/sendEmail'

export async function OPTIONS(
  req: Request,
  { params }: { params: Promise<{ roomName: string }> },
) {
  const { roomName } = await params
  return embedOptions(req, roomName)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomName: string }> },
) {
  try {
    const { roomName } = await params

    const guard = await guardEmbedRequest(req, roomName, {
      scope: 'mobile',
      perSession: EMBED_RATE_LIMITS.mobile,
      perIp: EMBED_RATE_LIMITS.mobile,
      dailyQuota: EMBED_DAILY_QUOTAS.mobile,
    })
    if (!guard.ok) return guard.response

    const body = (await req.json()) as {
      name?: string
      countryCode?: string
      phone?: string
      note?: string
      consent?: boolean
    }

    const name = String(body.name || '').trim()
    const countryCode = String(body.countryCode || '').trim()
    const phone = String(body.phone || '').trim()
    const note = String(body.note || '').trim()
    const consent = Boolean(body.consent)

    if (!phone || !consent) {
      return jsonWithCors(
        { ok: false, error: 'Phone and consent are required.' },
        guard.corsHeaders,
        { status: 400 },
      )
    }

    const agent = await prismaClient.liveKitAgent.findUnique({
      where: { roomName },
      select: { id: true, name: true },
    })

    if (!agent) {
      return jsonWithCors(
        { ok: false, error: 'Room not found.' },
        guard.corsHeaders,
        { status: 404 },
      )
    }

    const ownerUserId = await resolveRoomOwnerUserId(agent.id, roomName)
    if (!(await canSendEmail(ownerUserId))) {
      return jsonWithCors(
        { ok: false, error: 'Email delivery is not set up for this business yet.' },
        guard.corsHeaders,
        { status: 503 },
      )
    }
    const owner = ownerUserId
      ? await prismaClient.user.findUnique({
          where: { id: ownerUserId },
          select: { email: true },
        })
      : null

    const to = owner?.email?.trim()
    if (!to) {
      return jsonWithCors(
        { ok: false, error: 'This room has no creator email to notify.' },
        guard.corsHeaders,
        { status: 500 },
      )
    }

    const now = new Date().toISOString()
    await sendPlainEmail({
      userId: ownerUserId,
      fromName: agent.name,
      to,
      subject: `Callback request · ${agent.name} (${roomName})`,
      text: [
        `Room: ${roomName}`,
        `Agent: ${agent.name}`,
        `Name: ${name || 'Anonymous'}`,
        `Phone: ${countryCode} ${phone}`,
        `Consent: ${consent ? 'Yes' : 'No'}`,
        `Note: ${note || '-'}`,
        `Time: ${now}`,
      ].join('\n'),
    })

    return jsonWithCors({ ok: true }, guard.corsHeaders)
  } catch (error) {
    console.error('[mobile-callback]', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to submit callback request.' },
      { status: 500 },
    )
  }
}
