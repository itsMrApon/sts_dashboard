export type LlmModelProvider = 'google' | 'openai' | 'anthropic' | 'deepseek' | 'kimi' | 'openrouter' | 'xai'

export type LlmModelOption = { id: string; label: string; provider: LlmModelProvider }

export type LlmModelGroup = { group: string; items: LlmModelOption[] }

/** Curated defaults for LLM_CHOICE / agent fallback; IDs must match provider APIs. */
export const LLM_MODEL_GROUPS: LlmModelGroup[] = [
  {
    group: 'Google Gemini',
    items: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'google' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'google' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', provider: 'google' },
    ],
  },
  {
    group: 'OpenAI',
    items: [
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini (fast)', provider: 'openai' },
      { id: 'gpt-4.1', label: 'GPT-4.1', provider: 'openai' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini', provider: 'openai' },
      { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' },
      { id: 'gpt-5-mini', label: 'GPT-5 mini', provider: 'openai' },
      { id: 'gpt-5', label: 'GPT-5', provider: 'openai' },
    ],
  },
  {
    group: 'Anthropic Claude',
    items: [
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', provider: 'anthropic' },
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', provider: 'anthropic' },
      { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (fastest)', provider: 'anthropic' },
    ],
  },
  {
    group: 'DeepSeek',
    items: [
      { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', provider: 'deepseek' },
      { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', provider: 'deepseek' },
    ],
  },
  {
    group: 'Kimi',
    items: [
      { id: 'kimi-k2.6', label: 'Kimi K2.6', provider: 'kimi' },
      { id: 'kimi-k3', label: 'Kimi K3', provider: 'kimi' },
    ],
  },
  {
    group: 'xAI Grok',
    items: [
      // LiveKit xAI plugin default; the full list is fetched live from the user's xAI key.
      { id: 'grok-4-1-fast-non-reasoning', label: 'Grok 4.1 Fast', provider: 'xai' },
    ],
  },
  {
    group: 'OpenRouter',
    items: [
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini (via OpenRouter)', provider: 'openrouter' },
      { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (via OpenRouter)', provider: 'openrouter' },
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat (via OpenRouter)', provider: 'openrouter' },
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B (via OpenRouter)', provider: 'openrouter' },
    ],
  },
]

/** OpenRouter model slugs look like "vendor/model" (optionally ":variant"). Any slug is accepted. */
export const OPENROUTER_MODEL_ID_RE = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:-]*$/i

export function isOpenRouterModelId(id: string): boolean {
  const trimmed = id.trim()
  return trimmed.length <= 120 && OPENROUTER_MODEL_ID_RE.test(trimmed)
}

/** xAI model ids all start with "grok-"; the live list comes from the user's key. */
export const XAI_MODEL_ID_RE = /^grok-[a-z0-9][a-z0-9._-]*$/i

export function isXaiModelId(id: string): boolean {
  const trimmed = id.trim()
  return trimmed.length <= 100 && XAI_MODEL_ID_RE.test(trimmed)
}

export function providerForLlmModelId(id: string): LlmModelProvider | null {
  const trimmed = id.trim()
  for (const g of LLM_MODEL_GROUPS) {
    const found = g.items.find((i) => i.id === trimmed)
    if (found) return found.provider
  }
  if (isOpenRouterModelId(trimmed)) return 'openrouter'
  if (isXaiModelId(trimmed)) return 'xai'
  return null
}

export function labelForLlmModelId(id: string): string {
  const trimmed = id.trim()
  for (const g of LLM_MODEL_GROUPS) {
    const found = g.items.find((i) => i.id === trimmed)
    if (found) return found.label
  }
  return trimmed
}

/** Default model ID for a LiveKit llmProvider value. */
export function defaultModelForLlmProvider(provider: string): string {
  switch (provider) {
    case 'deepseek':
      return 'deepseek-v4-flash'
    case 'kimi':
      return 'kimi-k2.6'
    case 'openai':
      return 'gpt-4.1-mini'
    case 'anthropic':
      return 'claude-opus-5-5'
    case 'openrouter':
      return 'openai/gpt-4o-mini'
    case 'xai':
    case 'grok':
      return 'grok-4-1-fast-non-reasoning'
    case 'google':
    case 'gemini':
    default:
      return 'gemini-2.5-flash'
  }
}
