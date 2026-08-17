import { NextRequest, NextResponse } from 'next/server'
import { prismaClient } from '@/lib/prismaClient'
import { decryptToken } from '@/lib/messages/encrypt'
import { ingestFathomMeetingForUser } from '@/lib/leads/ingestFathomMeeting'
import type { FathomMeeting } from '@/lib/fathom/client'
import { resolveUserGeminiApiKey } from '@/lib/leads/resolveUserLlmKey'

export const runtime = 'nodejs'

function asMeeting(payload: unknown): FathomMeeting | null {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as Record<string, unknown>
  const meeting =
    (obj.meeting as FathomMeeting | undefined) ||
    (obj.data as FathomMeeting | undefined) ||
    (obj as unknown as FathomMeeting)
  if (meeting?.recording_id == null && (obj as { recording_id?: unknown }).recording_id == null) {
    // Some webhooks nest under recording
    const recording = obj.recording as FathomMeeting | undefined
    if (recording?.recording_id != null) return recording
  }
  if (meeting?.recording_id == null) return null
  return meeting
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const conn = await prismaClient.callIntelConnection.findUnique({
      where: { userId_provider: { userId, provider: 'FATHOM' } },
    })
    if (!conn || conn.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Fathom not connected' }, { status: 404 })
    }

    const body = await req.json().catch(() => null)
    const meeting = asMeeting(body)
    if (!meeting) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const user = await prismaClient.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    const geminiApiKey = await resolveUserGeminiApiKey(userId)
    await ingestFathomMeetingForUser({
      userId,
      ownerEmail: user?.email,
      meeting,
      autoScore: true,
      geminiApiKey,
    })

    // Touch connection metadata for ops visibility
    await prismaClient.callIntelConnection.update({
      where: { id: conn.id },
      data: {
        metadata: {
          ...((conn.metadata as object) || {}),
          lastWebhookAt: new Date().toISOString(),
        },
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Fathom webhook error', err)
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 })
  }
}

/** Optional GET health for webhook URL checks */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ ok: false }, { status: 400 })
  const conn = await prismaClient.callIntelConnection.findUnique({
    where: { userId_provider: { userId, provider: 'FATHOM' } },
    select: { status: true },
  })
  return NextResponse.json({
    ok: Boolean(conn),
    status: conn?.status || null,
    decryptReady: typeof decryptToken === 'function',
  })
}
