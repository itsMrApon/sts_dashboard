export type ConfigCredentialProvider =
  | 'google'
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'kimi'
  | 'deepgram'
  | 'fish'

export type ConfigProviderKind = 'llm' | 'stt' | 'tts'

export type ConfigProviderItem = {
  id: ConfigCredentialProvider
  name: string
  kind: ConfigProviderKind
  placeholder: string
}

export const CONFIG_PROVIDERS: ConfigProviderItem[] = [
  { id: 'google', name: 'Gemini', kind: 'llm', placeholder: 'AIza…' },
  { id: 'openai', name: 'OpenAI', kind: 'llm', placeholder: 'sk-…' },
  { id: 'anthropic', name: 'Claude', kind: 'llm', placeholder: 'sk-ant-…' },
  { id: 'deepseek', name: 'DeepSeek', kind: 'llm', placeholder: 'sk-…' },
  { id: 'kimi', name: 'Kimi', kind: 'llm', placeholder: 'sk-…' },
  { id: 'deepgram', name: 'Deepgram', kind: 'stt', placeholder: 'Deepgram API key…' },
  { id: 'fish', name: 'Fish Audio', kind: 'tts', placeholder: 'Fish Audio API key…' },
]

export const LLM_SURFACES = ['messages', 'leads', 'projects', 'tenants'] as const
export const VOICE_PROVIDERS = ['fish', 'vapi', 'deepgram', 'livekit'] as const
