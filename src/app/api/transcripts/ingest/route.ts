import { NextRequest, NextResponse } from 'next/server'
import { prismaClient } from '@/lib/prismaClient'
import { analyseTranscript } from '@/lib/leads/analyseTranscript'

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (apiKey !== process.env.N8N_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { userId, roomName, leadId, tenantId, campaignId, transcript, duration, outcome } =
      body as {
        userId: string
        roomName: string
        leadId?: string
        tenantId?: string
        /** @deprecated use tenantId */
        campaignId?: string
        transcript: { role: 'user' | 'agent'; text: string; timestamp: string }[]
        duration: number
        outcome?: string
      }

    const resolvedTenantId = tenantId ?? campaignId

    if (!userId || !roomName || !transcript?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const analysis = await analyseTranscript(transcript)

    const record = await prismaClient.callTranscript.create({
      data: {
        userId,
        roomName,
        leadId: leadId || null,
        tenantId: resolvedTenantId || null,
        transcript,
        duration: duration || 0,
        outcome: outcome || analysis.outcome,
        objections: analysis.objections,
        summary: analysis.summary,
      },
    })

    const ingestUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/events/ingest`
    await fetch(ingestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.N8N_API_KEY || '',
      },
      body: JSON.stringify({
        userId,
        eventType: 'CALL_ENDED',
        leadId,
        tenantId: resolvedTenantId,
        metadata: {
          outcome: outcome || analysis.outcome,
          duration,
          roomName,
          summary: analysis.summary,
          transcript,
        },
      }),
    })

    if (outcome === 'converted' || analysis.outcome === 'converted') {
      await fetch(ingestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.N8N_API_KEY || '',
        },
        body: JSON.stringify({
          userId,
          eventType: 'LEAD_CONVERTED',
          leadId,
          tenantId: resolvedTenantId,
        }),
      })
    }

    return NextResponse.json({ success: true, transcriptId: record.id }, { status: 201 })
  } catch (error) {
    console.error('[transcripts/ingest]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    )
  }
}
