import { NextRequest, NextResponse } from 'next/server'
import {
  normalizeUsageProvider,
  recordProviderUsage,
  type ProviderUsageKind,
} from '@/lib/usage/providerUsage'

type UsageIngestBody = {
  userId?: string
  surface?: string
  llmProvider?: string
  sttProvider?: string
  ttsProvider?: string
  llmInputTokens?: number
  llmOutputTokens?: number
  llmRequests?: number
  sttAudioMs?: number
  sttRequests?: number
  ttsCharacters?: number
  ttsRequests?: number
  sessionAudioMs?: number
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (apiKey !== process.env.N8N_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: UsageIngestBody
  try {
    body = (await req.json()) as UsageIngestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const jobs: Array<Promise<void>> = []
  const surface =
    typeof body.surface === 'string' ? body.surface.trim() : 'voice'

  const llmInput = Math.max(0, Math.floor(asNumber(body.llmInputTokens)))
  const llmOutput = Math.max(0, Math.floor(asNumber(body.llmOutputTokens)))
  const llmRequests = Math.max(0, Math.floor(asNumber(body.llmRequests)))
  if (llmInput > 0 || llmOutput > 0 || llmRequests > 0) {
    jobs.push(
      recordProviderUsage({
        userId,
        provider: normalizeUsageProvider(body.llmProvider || 'google'),
        kind: 'llm' satisfies ProviderUsageKind,
        surface,
        requestCount: llmRequests || 1,
        inputUnits: llmInput,
        outputUnits: llmOutput,
      }),
    )
  }

  const sttMs = Math.max(0, Math.floor(asNumber(body.sttAudioMs)))
  const sttRequests = Math.max(0, Math.floor(asNumber(body.sttRequests)))
  if (sttMs > 0 || sttRequests > 0) {
    jobs.push(
      recordProviderUsage({
        userId,
        provider: normalizeUsageProvider(body.sttProvider || 'deepgram'),
        kind: 'stt',
        surface,
        requestCount: sttRequests || 1,
        inputUnits: sttMs,
      }),
    )
  }

  const ttsChars = Math.max(0, Math.floor(asNumber(body.ttsCharacters)))
  const ttsRequests = Math.max(0, Math.floor(asNumber(body.ttsRequests)))
  if (ttsChars > 0 || ttsRequests > 0) {
    jobs.push(
      recordProviderUsage({
        userId,
        provider: normalizeUsageProvider(body.ttsProvider || 'deepgram'),
        kind: 'tts',
        surface,
        requestCount: ttsRequests || 1,
        inputUnits: ttsChars,
      }),
    )
  }

  const sessionMs = Math.max(0, Math.floor(asNumber(body.sessionAudioMs)))
  if (sessionMs > 0) {
    jobs.push(
      recordProviderUsage({
        userId,
        provider: 'livekit',
        kind: 'stt',
        surface,
        requestCount: 1,
        inputUnits: sessionMs,
      }),
    )
  }

  if (jobs.length === 0) {
    return NextResponse.json({ ok: true, recorded: 0 })
  }

  await Promise.all(jobs)
  return NextResponse.json({ ok: true, recorded: jobs.length })
}
