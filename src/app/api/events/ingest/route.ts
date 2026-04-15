import { NextRequest, NextResponse } from 'next/server'
import { prismaClient } from '@/lib/prismaClient'
import { analyseTranscript } from '@/lib/leads/analyseTranscript'
import { EventType, Prisma } from '@prisma/client'

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (apiKey !== process.env.N8N_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { userId, eventType, leadId, tenantId, channel, metadata } = body as {
      userId: string
      eventType: string
      leadId?: string
      /** @deprecated use tenantId */
      campaignId?: string
      tenantId?: string
      channel?: string
      metadata?: Record<string, unknown>
    }

    const resolvedTenantId = tenantId ?? body.campaignId

    if (!userId || !eventType) {
      return NextResponse.json({ error: 'userId and eventType required' }, { status: 400 })
    }

    const event = await prismaClient.eventLog.create({
      data: {
        userId,
        eventType: eventType as EventType,
        leadId: leadId || null,
        tenantId: resolvedTenantId || null,
        channel: channel || null,
        metadata: metadata == null ? Prisma.JsonNull : (metadata as Prisma.InputJsonValue),
      },
    })

    if (eventType === 'CALL_ENDED') {
      const transcript = metadata?.transcript as
        | { role: string; text: string; timestamp?: string }[]
        | undefined
      if (transcript && Array.isArray(transcript)) {
        const analysis = await analyseTranscript(transcript)
        await prismaClient.callTranscript.create({
          data: {
            userId,
            roomName: (metadata?.roomName as string) || 'unknown',
            leadId: leadId || null,
            tenantId: resolvedTenantId || null,
            transcript,
            duration: (metadata?.duration as number) || 0,
            outcome: (metadata?.outcome as string) || analysis.outcome,
            objections: analysis.objections,
            summary: analysis.summary,
          },
        })
      }
    }

    return NextResponse.json({ success: true, eventId: event.id }, { status: 201 })
  } catch (error) {
    console.error('[events/ingest]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    )
  }
}
