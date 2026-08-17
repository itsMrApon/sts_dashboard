import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { prismaClient } from '@/lib/prismaClient'
import { EMBED_RATE_LIMITS } from '@/lib/embed/rateLimit'
import {
  clientIp,
  embedOptions,
  guardEmbedRequest,
  jsonWithCors,
} from '@/lib/embed/embedRouteGuard'
import { resolveRoomOwnerUserId } from '@/lib/messages/resolveRoomOwnerUserId'

function getSmtpTransport() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM || user
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true'

  if (!host || !user || !pass || !from || Number.isNaN(port)) {
    return null
  }

  return { host, port, user, pass, from, secure }
}

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
      key: `embed:mobile:${roomName}:${clientIp(req)}`,
      limit: EMBED_RATE_LIMITS.mobile.limit,
      windowMs: EMBED_RATE_LIMITS.mobile.windowMs,
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

    const smtp = getSmtpTransport()
    if (!smtp) {
      return jsonWithCors(
        {
          ok: false,
          error: 'Email delivery is not configured. Set SMTP_HOST/PORT/USER/PASS/FROM.',
        },
        guard.corsHeaders,
        { status: 503 },
      )
    }

    const ownerUserId = await resolveRoomOwnerUserId(agent.id, roomName)
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
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
    })

    await transporter.sendMail({
      from: smtp.from,
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
