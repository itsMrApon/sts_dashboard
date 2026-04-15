export type LlmModelProvider = 'google' | 'openai' | 'anthropic'

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
