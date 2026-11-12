import 'server-only'

export type OpenRouterModel = {
  id: string
  name: string
  contextLength: number | null
  /** USD per 1M prompt / completion tokens, when OpenRouter reports pricing. */
  promptPerMillion: number | null
  completionPerMillion: number | null
}

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models'
const FETCH_TIMEOUT_MS = 8_000

function perMillion(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN
  return Number.isFinite(parsed) && parsed >= 0 ? parsed * 1_000_000 : null
}

/**
 * Public OpenRouter catalog (no key needed), cached for an hour. Text-output models only,
 * since voice agents need a chat model. Returns [] when OpenRouter is unreachable.
 */
export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  try {
    const res = await fetch(OPENROUTER_MODELS_URL, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return []
    const body = (await res.json()) as { data?: unknown }
    if (!Array.isArray(body.data)) return []

    const models: OpenRouterModel[] = []
    for (const raw of body.data) {
      if (!raw || typeof raw !== 'object') continue
      const item = raw as Record<string, unknown>
      if (typeof item.id !== 'string') continue
      const architecture = item.architecture as { output_modalities?: unknown } | undefined
      const outputs = architecture?.output_modalities
      if (Array.isArray(outputs) && !outputs.includes('text')) continue
      const pricing = (item.pricing ?? {}) as Record<string, unknown>
      models.push({
        id: item.id,
        name: typeof item.name === 'string' ? item.name : item.id,
        contextLength: typeof item.context_length === 'number' ? item.context_length : null,
        promptPerMillion: perMillion(pricing.prompt),
        completionPerMillion: perMillion(pricing.completion),
      })
    }
    return models.sort((a, b) => a.name.localeCompare(b.name))
  } catch (error) {
    console.error('[fetchOpenRouterModels]', error instanceof Error ? error.message : error)
    return []
  }
}

/** Text models on the user's xAI key ("grok-*"), newest first. Returns [] on any failure. */
export async function fetchXaiModels(apiKey: string): Promise<{ id: string }[]> {
  try {
    const res = await fetch('https://api.x.ai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return []
    const body = (await res.json()) as { data?: { id?: unknown; created?: unknown }[] }
    return (body.data ?? [])
      .filter((item): item is { id: string; created?: unknown } => typeof item.id === 'string' && item.id.startsWith('grok-'))
      .filter((item) => !/image|imagine|vision|voice|tts|stt/i.test(item.id))
      .sort((a, b) => Number(b.created ?? 0) - Number(a.created ?? 0))
      .map((item) => ({ id: item.id }))
  } catch (error) {
    console.error('[fetchXaiModels]', error instanceof Error ? error.message : error)
    return []
  }
}
