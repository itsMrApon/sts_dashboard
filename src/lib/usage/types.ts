export type ProviderUsageKind = 'llm' | 'stt' | 'tts'

export type UsageSurface =
  | 'messages'
  | 'leads'
  | 'projects'
  | 'tenants'
  | 'voice'
  | 'app'

export type RecordProviderUsageInput = {
  userId: string
  provider: string
  kind: ProviderUsageKind
  surface?: UsageSurface | string | null
  requestCount?: number
  inputUnits?: number
  outputUnits?: number
}

export type UsageDayPoint = {
  day: string
  llmRequests: number
  sttRequests: number
  ttsRequests: number
  llmTokens: number
  sttMs: number
  ttsChars: number
}

export type UsageKindTotals = {
  requests: number
  inputUnits: number
  outputUnits: number
}

export type UsageProviderRow = {
  provider: string
  kind: ProviderUsageKind
  requests: number
  inputUnits: number
  outputUnits: number
}

export type UsageSurfaceRow = {
  surface: UsageSurface
  requests: number
  tokens: number
}

export type UsageVoiceRow = {
  provider: string
  requests: number
  sttMs: number
  ttsChars: number
}

export type ProviderUsageDashboard = {
  rangeDays: number
  totals: {
    llm: UsageKindTotals
    stt: UsageKindTotals
    tts: UsageKindTotals
  }
  series: UsageDayPoint[]
  byProvider: UsageProviderRow[]
  byLlmSurface: UsageSurfaceRow[]
  byVoiceProvider: UsageVoiceRow[]
}
