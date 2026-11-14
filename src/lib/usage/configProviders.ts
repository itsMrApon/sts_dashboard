export type ConfigCredentialProvider =
  | 'google'
  | 'openai'
  | 'anthropic'
  | 'openrouter'
  | 'xai'
  | 'deepseek'
  | 'kimi'
  | 'deepgram'
  | 'fish'

export type ConfigProviderKind = 'llm' | 'stt' | 'tts'

/** Every engine stage a provider's key can power. */
export type ProviderCapability = 'llm' | 'stt' | 'tts' | 'realtime'

export type ConfigProviderItem = {
  id: ConfigCredentialProvider
  name: string
  kind: ConfigProviderKind
  placeholder: string
  /** One line on what this provider does in the product. */
  tagline: string
  /** Where the user creates a key. */
  keyUrl: string
  /** Server env var used when no key is saved in Config Agent. */
  envVar: string
  /** Expected key prefix, used only for a soft format hint. */
  keyPrefix?: string
  /** Two-letter mark for the provider tile. */
  monogram: string
  /** Tailwind gradient classes for the provider tile. */
  accent: string
  capabilities: ProviderCapability[]
}

export const CONFIG_PROVIDERS: ConfigProviderItem[] = [
  {
    id: 'google',
    name: 'Gemini',
    kind: 'llm',
    placeholder: 'AIza…',
    tagline: 'Default brain for chat and leads. Also Gemini TTS, STT and Live.',
    keyUrl: 'https://aistudio.google.com/apikey',
    envVar: 'GOOGLE_API_KEY',
    keyPrefix: 'AIza',
    monogram: 'Ge',
    accent: 'from-sky-500 to-indigo-500',
    capabilities: ['llm', 'stt', 'tts', 'realtime'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    kind: 'llm',
    placeholder: 'sk-…',
    tagline: 'GPT models, transcription, natural TTS voices and Realtime.',
    keyUrl: 'https://platform.openai.com/api-keys',
    envVar: 'OPENAI_API_KEY',
    keyPrefix: 'sk-',
    monogram: 'Oa',
    accent: 'from-emerald-500 to-teal-600',
    capabilities: ['llm', 'stt', 'tts', 'realtime'],
  },
  {
    id: 'anthropic',
    name: 'Claude',
    kind: 'llm',
    placeholder: 'sk-ant-…',
    tagline: 'Claude Opus, Sonnet and Haiku for voice agents.',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    envVar: 'ANTHROPIC_API_KEY',
    keyPrefix: 'sk-ant-',
    monogram: 'Cl',
    accent: 'from-orange-400 to-amber-600',
    capabilities: ['llm'],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    kind: 'llm',
    placeholder: 'sk-or-v1-…',
    tagline: 'One key, 300+ models from every major lab.',
    keyUrl: 'https://openrouter.ai/settings/keys',
    envVar: 'OPENROUTER_API_KEY',
    keyPrefix: 'sk-or-',
    monogram: 'OR',
    accent: 'from-violet-500 to-fuchsia-600',
    capabilities: ['llm'],
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    kind: 'llm',
    placeholder: 'xai-…',
    tagline: 'Grok brain, Grok voices, and Grok Voice realtime on one key.',
    keyUrl: 'https://console.x.ai/',
    envVar: 'XAI_API_KEY',
    keyPrefix: 'xai-',
    monogram: 'xG',
    accent: 'from-neutral-600 to-neutral-900',
    capabilities: ['llm', 'stt', 'tts', 'realtime'],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    kind: 'llm',
    placeholder: 'sk-…',
    tagline: 'Low-cost reasoning models.',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    envVar: 'DEEPSEEK_API_KEY',
    keyPrefix: 'sk-',
    monogram: 'Ds',
    accent: 'from-blue-500 to-cyan-500',
    capabilities: ['llm'],
  },
  {
    id: 'kimi',
    name: 'Kimi',
    kind: 'llm',
    placeholder: 'sk-…',
    tagline: 'Moonshot long-context models.',
    keyUrl: 'https://platform.moonshot.ai/console/api-keys',
    envVar: 'MOONSHOT_API_KEY',
    keyPrefix: 'sk-',
    monogram: 'Ki',
    accent: 'from-zinc-500 to-zinc-700',
    capabilities: ['llm'],
  },
  {
    id: 'deepgram',
    name: 'Deepgram',
    kind: 'stt',
    placeholder: 'Deepgram API key…',
    tagline: 'Hears the caller. Speech-to-text on every call.',
    keyUrl: 'https://console.deepgram.com/',
    envVar: 'DEEPGRAM_API_KEY',
    monogram: 'Dg',
    accent: 'from-lime-500 to-green-600',
    capabilities: ['stt', 'tts'],
  },
  {
    id: 'fish',
    name: 'Fish Audio',
    kind: 'tts',
    placeholder: 'Fish Audio API key…',
    tagline: 'Speaks back. Bangla-capable and cloned voices.',
    keyUrl: 'https://fish.audio/app/api-keys/',
    envVar: 'FISH_API_KEY',
    monogram: 'Fi',
    accent: 'from-rose-500 to-pink-600',
    capabilities: ['tts'],
  },
]

export const CONFIG_PROVIDER_IDS = CONFIG_PROVIDERS.map((item) => item.id)

export function isConfigCredentialProvider(value: unknown): value is ConfigCredentialProvider {
  return typeof value === 'string' && (CONFIG_PROVIDER_IDS as string[]).includes(value)
}

export function configProviderById(id: ConfigCredentialProvider): ConfigProviderItem {
  const found = CONFIG_PROVIDERS.find((item) => item.id === id)
  if (!found) throw new Error(`Unknown provider ${id}`)
  return found
}

export type ProviderKeySource = 'database' | 'none'

/** Client-safe status for one provider key (never contains the key itself). */
export type ProviderKeyStatus = {
  hasKey: boolean
  masked: string | null
  source: ProviderKeySource
  validatedAt: string | null
}

export type ProviderKeyCheck = {
  valid: boolean
  code: 'VALID' | 'MISSING' | 'INVALID' | 'QUOTA_EXCEEDED' | 'PERMISSION_DENIED' | 'NETWORK' | 'UNKNOWN'
  message: string
  /** Extra facts from the provider, e.g. model count or remaining credit. */
  details?: string[]
}

export const LLM_SURFACES = ['messages', 'leads', 'projects', 'tenants'] as const
export const VOICE_PROVIDERS = ['fish', 'vapi', 'deepgram', 'livekit'] as const
