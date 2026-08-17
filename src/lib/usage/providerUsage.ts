import { prismaClient } from '@/lib/prismaClient'
import { providerForLlmModelId } from '@/lib/llm/modelOptions'
import type {
  ProviderUsageDashboard,
  ProviderUsageKind,
  RecordProviderUsageInput,
  UsageDayPoint,
  UsageKindTotals,
  UsageProviderRow,
  UsageSurface,
  UsageSurfaceRow,
  UsageVoiceRow,
} from '@/lib/usage/types'
import { LLM_SURFACES, VOICE_PROVIDERS } from '@/lib/usage/configProviders'

export type {
  ProviderUsageDashboard,
  ProviderUsageKind,
  RecordProviderUsageInput,
  UsageDayPoint,
  UsageKindTotals,
  UsageProviderRow,
  UsageSurface,
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SURFACES: UsageSurface[] = [
  'messages',
  'leads',
  'projects',
  'tenants',
  'voice',
  'app',
]

type DailyRow = {
  provider: string
  kind: string
  surface: string
  day: Date
  requestCount: number
  inputUnits: string | number | bigint
  outputUnits: string | number | bigint
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

function toNonNegInt(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value as number))
}

function toNumber(value: string | number | bigint): number {
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function normalizeUsageProvider(raw: string): string {
  const provider = raw.trim().toLowerCase()
  if (provider === 'gemini') return 'google'
  if (provider === 'claude') return 'anthropic'
  if (provider === 'fishaudio' || provider === 'fish_audio') return 'fish'
  if (provider === 'moonshot') return 'kimi'
  return provider.slice(0, 32) || 'google'
}

export function normalizeUsageSurface(
  raw?: string | null,
): UsageSurface {
  const surface = (raw || 'app').trim().toLowerCase()
  if (SURFACES.includes(surface as UsageSurface)) return surface as UsageSurface
  return 'app'
}

export function llmProviderFromModel(model?: string | null): string {
  return providerForLlmModelId(model?.trim() || '') || 'google'
}

function utcDayString(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

function emptyTotals(): UsageKindTotals {
  return { requests: 0, inputUnits: 0, outputUnits: 0 }
}

export async function recordProviderUsage(
  input: RecordProviderUsageInput,
): Promise<void> {
  const userId = input.userId?.trim()
  if (!userId || !isUuid(userId)) return

  const provider = normalizeUsageProvider(input.provider)
  const kind = input.kind
  if (kind !== 'llm' && kind !== 'stt' && kind !== 'tts') return
  const surface = normalizeUsageSurface(input.surface)

  const requestCount = Math.max(1, toNonNegInt(input.requestCount ?? 1))
  const inputUnits = toNonNegInt(input.inputUnits)
  const outputUnits = toNonNegInt(input.outputUnits)
  const day = utcDayString()

  try {
    await prismaClient.$executeRaw`
      INSERT INTO "ProviderUsageDaily" (
        "id",
        "userId",
        "provider",
        "kind",
        "surface",
        "day",
        "requestCount",
        "inputUnits",
        "outputUnits",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        gen_random_uuid(),
        ${userId}::uuid,
        ${provider},
        ${kind},
        ${surface},
        ${day}::date,
        ${requestCount},
        ${inputUnits},
        ${outputUnits},
        now(),
        now()
      )
      ON CONFLICT ("userId", "provider", "kind", "surface", "day")
      DO UPDATE SET
        "requestCount" = "ProviderUsageDaily"."requestCount" + EXCLUDED."requestCount",
        "inputUnits" = "ProviderUsageDaily"."inputUnits" + EXCLUDED."inputUnits",
        "outputUnits" = "ProviderUsageDaily"."outputUnits" + EXCLUDED."outputUnits",
        "updatedAt" = now()
    `
  } catch (error) {
    console.error('[provider-usage] record failed', error)
  }
}

export function recordProviderUsageLater(
  input: RecordProviderUsageInput,
): void {
  void recordProviderUsage(input)
}

export async function getProviderUsageDashboard(
  userId: string,
  rangeDays: number,
): Promise<ProviderUsageDashboard> {
  const days = rangeDays === 7 || rangeDays === 30 ? rangeDays : 14
  const emptyLlmSurfaces: UsageSurfaceRow[] = LLM_SURFACES.map((surface) => ({
    surface,
    requests: 0,
    tokens: 0,
  }))
  const emptyVoice: UsageVoiceRow[] = VOICE_PROVIDERS.map((provider) => ({
    provider,
    requests: 0,
    sttMs: 0,
    ttsChars: 0,
  }))
  const empty: ProviderUsageDashboard = {
    rangeDays: days,
    totals: { llm: emptyTotals(), stt: emptyTotals(), tts: emptyTotals() },
    series: [],
    byProvider: [],
    byLlmSurface: emptyLlmSurfaces,
    byVoiceProvider: emptyVoice,
  }

  if (!isUuid(userId)) return empty

  const from = new Date()
  from.setUTCDate(from.getUTCDate() - (days - 1))
  const fromDay = from.toISOString().slice(0, 10)

  let rows: DailyRow[] = []
  try {
    rows = await prismaClient.$queryRaw<DailyRow[]>`
      SELECT
        "provider",
        "kind",
        "surface",
        "day",
        "requestCount",
        "inputUnits"::text AS "inputUnits",
        "outputUnits"::text AS "outputUnits"
      FROM "ProviderUsageDaily"
      WHERE "userId" = ${userId}::uuid
        AND "day" >= ${fromDay}::date
      ORDER BY "day" ASC
    `
  } catch (error) {
    console.error('[provider-usage] query failed', error)
    return empty
  }

  const totals = {
    llm: emptyTotals(),
    stt: emptyTotals(),
    tts: emptyTotals(),
  }
  const byProviderMap = new Map<string, UsageProviderRow>()
  const byDay = new Map<string, UsageDayPoint>()
  const llmSurfaceMap = new Map<string, UsageSurfaceRow>(
    emptyLlmSurfaces.map((row) => [row.surface, { ...row }]),
  )
  const voiceMap = new Map<string, UsageVoiceRow>(
    emptyVoice.map((row) => [row.provider, { ...row }]),
  )

  for (let i = 0; i < days; i += 1) {
    const d = new Date(from)
    d.setUTCDate(from.getUTCDate() + i)
    const key = d.toISOString().slice(0, 10)
    byDay.set(key, {
      day: key,
      llmRequests: 0,
      sttRequests: 0,
      ttsRequests: 0,
      llmTokens: 0,
      sttMs: 0,
      ttsChars: 0,
    })
  }

  for (const row of rows) {
    const kind = row.kind === 'stt' || row.kind === 'tts' ? row.kind : 'llm'
    const requests = toNumber(row.requestCount)
    const inputUnits = toNumber(row.inputUnits)
    const outputUnits = toNumber(row.outputUnits)
    const surface = normalizeUsageSurface(row.surface)
    const provider = normalizeUsageProvider(row.provider)
    const isTransport = provider === 'livekit' || provider === 'vapi'

    if (!isTransport) {
      totals[kind].requests += requests
      totals[kind].inputUnits += inputUnits
      totals[kind].outputUnits += outputUnits
    }

    const providerKey = `${provider}:${kind}`
    const existing = byProviderMap.get(providerKey)
    if (existing) {
      existing.requests += requests
      existing.inputUnits += inputUnits
      existing.outputUnits += outputUnits
    } else {
      byProviderMap.set(providerKey, {
        provider,
        kind,
        requests,
        inputUnits,
        outputUnits,
      })
    }

    if (kind === 'llm') {
      const mappedSurface =
        surface === 'voice' || surface === 'app' ? 'messages' : surface
      const llmRow = llmSurfaceMap.get(mappedSurface)
      if (llmRow) {
        llmRow.requests += requests
        llmRow.tokens += inputUnits + outputUnits
      }
    }

    const voiceRow = voiceMap.get(provider)
    if (voiceRow && (kind === 'stt' || kind === 'tts')) {
      voiceRow.requests += requests
      if (kind === 'stt') voiceRow.sttMs += inputUnits
      if (kind === 'tts') voiceRow.ttsChars += inputUnits
    }

    const dayKey =
      row.day instanceof Date
        ? row.day.toISOString().slice(0, 10)
        : String(row.day).slice(0, 10)
    const point = byDay.get(dayKey)
    if (!point) continue
    if (kind === 'llm') {
      point.llmRequests += requests
      point.llmTokens += inputUnits + outputUnits
    } else if (kind === 'stt') {
      point.sttRequests += requests
      point.sttMs += inputUnits
    } else {
      point.ttsRequests += requests
      point.ttsChars += inputUnits
    }
  }

  return {
    rangeDays: days,
    totals,
    series: Array.from(byDay.values()),
    byProvider: Array.from(byProviderMap.values()).sort(
      (a, b) => b.requests - a.requests,
    ),
    byLlmSurface: LLM_SURFACES.map(
      (surface) => llmSurfaceMap.get(surface) || { surface, requests: 0, tokens: 0 },
    ),
    byVoiceProvider: VOICE_PROVIDERS.map(
      (provider) =>
        voiceMap.get(provider) || {
          provider,
          requests: 0,
          sttMs: 0,
          ttsChars: 0,
        },
    ),
  }
}
