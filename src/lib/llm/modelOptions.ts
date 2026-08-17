export type LlmModelProvider = 'google' | 'openai' | 'anthropic' | 'deepseek' | 'kimi'

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
      { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini', provider: 'openai' },
      { id: 'o1', label: 'o1', provider: 'openai' },
      { id: 'o3-mini', label: 'o3-mini', provider: 'openai' },
    ],
  },
  {
    group: 'Anthropic Claude',
    items: [
      { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', provider: 'anthropic' },
      { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', provider: 'anthropic' },
      { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus', provider: 'anthropic' },
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
]

export function providerForLlmModelId(id: string): LlmModelProvider | null {
  const trimmed = id.trim()
  for (const g of LLM_MODEL_GROUPS) {
    const found = g.items.find((i) => i.id === trimmed)
    if (found) return found.provider
  }
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
      return 'gpt-4o'
    case 'anthropic':
      return 'claude-3-5-sonnet-20241022'
    case 'google':
    case 'gemini':
    default:
      return 'gemini-2.5-flash'
  }
}
