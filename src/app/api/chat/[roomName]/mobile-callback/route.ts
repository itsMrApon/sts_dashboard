import { NextResponse } from 'next/server'
import { Platform } from '@prisma/client'
import nodemailer from 'nodemailer'
import { prismaClient } from '@/lib/prismaClient'

type StoredMessage = {
  role: 'user' | 'assistant' | 'error'
  content: string
  timestamp?: string
}

const MOBILE_SMTP_LABEL = 'MOBILE_SMTP_CALLBACK'

const CANDIDATE_PLATFORMS: Platform[] = [
  Platform.SLACK,
  Platform.FACEBOOK_MESSENGER,
  Platform.INSTAGRAM,
  Platform.TIKTOK,
  Platform.WHATSAPP,
  Platform.DISCORD,
  Platform.TELEGRAM,
  Platform.YOUTUBE,
]

function getSmtpConfig() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM || user
  const to = process.env.SMTP_TO
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true'

  if (!host || !user || !pass || !from || !to || Number.isNaN(port)) {
    return null
  }

  return { host, port, user, pass, from, to, secure }
}

async function getOrCreateMobileChannel(roomName: string) {
  const existing = await prismaClient.messageChannel.findFirst({
    where: {
      roomName,
      accountLabel: MOBILE_SMTP_LABEL,
    },
  })
  if (existing) return existing

  const channels = await prismaClient.messageChannel.findMany({
    where: { roomName },
    select: { platform: true },
  })
  const used = new Set(channels.map((c) => c.platform))
  const free = CANDIDATE_PLATFORMS.find((p) => !used.has(p))

  if (!free) return null

  return prismaClient.messageChannel.create({
    data: {
      roomName,
      platform: free,
      status: 'ACTIVE',
      accountLabel: MOBILE_SMTP_LABEL,
    },
  })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomName: string }> },
) {
  try {
    const { roomName } = await params
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
      return NextResponse.json(
        { ok: false, error: 'Phone and consent are required.' },
        { status: 400 },
      )
    }

    const agent = await prismaClient.liveKitAgent.findUnique({
      where: { roomName },
      select: { name: true },
    })

    if (!agent) {
      return NextResponse.json(
        { ok: false, error: 'Room not found.' },
        { status: 404 },
      )
    }

    const channel = await getOrCreateMobileChannel(roomName)
    if (!channel) {
      return NextResponse.json(
        { ok: false, error: 'No available channel slot for mobile callback.' },
        { status: 500 },
      )
    }

    const externalId = `mobile:${countryCode}${phone}`
    const existing = await prismaClient.messageConversation.findUnique({
      where: {
        channelId_externalId: {
          channelId: channel.id,
          externalId,
        },
      },
      select: { messages: true },
    })

    const history: StoredMessage[] = Array.isArray(existing?.messages)
      ? (existing.messages as StoredMessage[])
      : []

    const now = new Date().toISOString()
    const userLine = `Callback request from ${name || 'Anonymous'} (${countryCode} ${phone})${
      note ? `\nNote: ${note}` : ''
    }`

    const updated: StoredMessage[] = [
      ...history,
      { role: 'user', content: userLine, timestamp: now },
      {
        role: 'assistant',
        content: 'Callback request captured and forwarded to team.',
        timestamp: now,
      },
    ].slice(-100)

    await prismaClient.messageConversation.upsert({
      where: {
        channelId_externalId: {
          channelId: channel.id,
          externalId,
        },
      },
      create: {
        channelId: channel.id,
        externalId,
        platform: channel.platform,
        messages: updated,
      },
      update: { messages: updated },
    })

    const smtp = getSmtpConfig()
    if (!smtp) {
      return NextResponse.json({
        ok: true,
        warning:
          'Callback saved to conversations, but SMTP is not configured. Set SMTP_HOST/PORT/USER/PASS/FROM/TO.',
      })
    }

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
      to: smtp.to,
      subject: `Mobile callback request · ${agent.name} (${roomName})`,
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

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[mobile-callback]', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to submit callback request.' },
      { status: 500 },
    )
  }
}

