import { DEFAULT_LLM_MODEL } from '@/lib/llm/defaultModel'
import {
  defaultModelForLlmProvider,
  isOpenRouterModelId,
  isXaiModelId,
  labelForLlmModelId,
  LLM_MODEL_GROUPS,
  type LlmModelProvider,
} from '@/lib/llm/modelOptions'

/**
 * Client-safe engine catalog: every choice the AI engine editor offers, per stage, with Bangla
 * support marked. Server-side resolution lives in engineSettings.ts; the voice worker
 * (agents/python/livekit-agent/agent/pipeline.py) must accept every value listed here.
 */

export type EngineMode = 'pipeline' | 'realtime'
export type SttProvider = 'deepgram' | 'openai' | 'google' | 'xai'
export type VoiceProvider = 'deepgram' | 'fish' | 'openai' | 'google' | 'xai'
export type RealtimeProvider = 'openai' | 'google' | 'xai'

export type AgentEngine = {
  mode: EngineMode
  sttProvider: SttProvider
  /** null = provider default (Deepgram picks per agent language). */
  sttModel: string | null
  llmProvider: LlmModelProvider
  llmModel: string
  voiceProvider: VoiceProvider
  /** Voice id: Deepgram model, Fish reference id, or the provider's voice name. */
  voiceModel: string
  /** Speaking-style instructions (accent, tone) for OpenAI/Gemini TTS and every realtime model. */
  voiceStyle: string | null
  realtimeProvider: RealtimeProvider
  realtimeModel: string
  realtimeVoice: string
}

export type AgentLanguage = 'en' | 'bn'

export const AGENT_LANGUAGES: { value: AgentLanguage; label: string; native: string }[] = [
  { value: 'bn', label: 'Bangla', native: 'বাংলা' },
  { value: 'en', label: 'English', native: 'English' },
]

/** How well a provider handles Bangla in this stage, from provider/plugin language lists. */
export type BanglaSupport = 'yes' | 'none' | 'untested'

export const BANGLA_LABEL: Record<BanglaSupport, string> = {
  yes: 'Bangla',
  none: 'English only',
  untested: 'Bangla untested',
}

type Choice = { id: string; label: string }

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

// --- Hears (STT) -------------------------------------------------------------

export const STT_PROVIDER_OPTIONS: {
  value: SttProvider
  label: string
  bangla: BanglaSupport
  models: Choice[]
  note: string
}[] = [
  {
    value: 'deepgram',
    label: 'Deepgram',
    bangla: 'none',
    models: [{ id: '', label: 'Auto by agent language (nova-2)' }],
    note: 'Fast and cheap for English. Its model list has no Bangla.',
  },
  {
    value: 'openai',
    label: 'OpenAI',
    bangla: 'yes',
    models: [
      { id: 'gpt-4o-transcribe', label: 'GPT-4o Transcribe (most accurate)' },
      { id: 'gpt-4o-mini-transcribe', label: 'GPT-4o mini Transcribe (faster)' },
    ],
    note: 'Strong on Bangla and mixed Bangla-English speech.',
  },
  {
    value: 'google',
    label: 'Google Gemini',
    bangla: 'yes',
    models: [{ id: '', label: 'Gemini live transcription (default)' }],
    note: 'Uses your Gemini key. Bangla runs as bn-BD.',
  },
  {
    value: 'xai',
    label: 'xAI Grok',
    bangla: 'none',
    models: [{ id: '', label: 'Grok STT (default)' }],
    note: 'No Bangla: Bangla agents fall back to Deepgram automatically.',
  },
]

// --- Thinks (LLM) -------------------------------------------------------------

export const LLM_PROVIDER_OPTIONS: { value: LlmModelProvider; label: string; enabled: boolean }[] = [
  { value: 'google', label: 'Google Gemini', enabled: true },
  { value: 'openai', label: 'OpenAI', enabled: true },
  { value: 'anthropic', label: 'Anthropic Claude', enabled: true },
  { value: 'xai', label: 'xAI Grok', enabled: true },
  { value: 'deepseek', label: 'DeepSeek', enabled: true },
  { value: 'kimi', label: 'Kimi', enabled: true },
  { value: 'openrouter', label: 'OpenRouter (300+ models)', enabled: true },
]

// --- Speaks (TTS) -------------------------------------------------------------

export const DEEPGRAM_VOICES: Choice[] = [
  { id: 'aura-asteria-en', label: 'Aura Asteria (EN)' },
  { id: 'aura-luna-en', label: 'Aura Luna (EN)' },
  { id: 'aura-stella-en', label: 'Aura Stella (EN)' },
  { id: 'aura-athena-en', label: 'Aura Athena (EN)' },
  { id: 'aura-hera-en', label: 'Aura Hera (EN)' },
  { id: 'aura-orion-en', label: 'Aura Orion (EN)' },
  { id: 'aura-arcas-en', label: 'Aura Arcas (EN)' },
  { id: 'aura-perseus-en', label: 'Aura Perseus (EN)' },
  { id: 'aura-angus-en', label: 'Aura Angus (EN)' },
  { id: 'aura-orpheus-en', label: 'Aura Orpheus (EN)' },
  { id: 'aura-helios-en', label: 'Aura Helios (EN)' },
  { id: 'aura-zeus-en', label: 'Aura Zeus (EN)' },
  { id: 'aura-2-thalia-en', label: 'Aura 2 Thalia — warm (EN)' },
  { id: 'aura-2-andromeda-en', label: 'Aura 2 Andromeda — calm (EN)' },
  { id: 'aura-2-apollo-en', label: 'Aura 2 Apollo — confident (EN)' },
  { id: 'aura-2-orion-en', label: 'Aura 2 Orion — friendly (EN)' },
]

export const DEFAULT_DEEPGRAM_VOICE = 'aura-asteria-en'

const OPENAI_TTS_VOICES: Choice[] = ['coral', 'alloy', 'ash', 'ballad', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer'].map(
  (id) => ({ id, label: titleCase(id) }),
)

const GEMINI_VOICES: Choice[] = [
  'Kore', 'Puck', 'Aoede', 'Charon', 'Fenrir', 'Leda', 'Orus', 'Zephyr', 'Achernar', 'Achird', 'Algenib',
  'Algieba', 'Alnilam', 'Autonoe', 'Callirrhoe', 'Despina', 'Enceladus', 'Erinome', 'Gacrux', 'Iapetus',
  'Laomedeia', 'Pulcherrima', 'Rasalgethi', 'Sadachbia', 'Sadaltager', 'Schedar', 'Sulafat', 'Umbriel',
  'Vindemiatrix', 'Zubenelgenubi',
].map((id) => ({ id, label: id }))

const GROK_VOICES: Choice[] = [
  'ara', 'eve', 'leo', 'rex', 'sal', 'luna', 'iris', 'orion', 'helix', 'carina', 'zagan', 'altair', 'zenith',
  'perseus', 'helios', 'lux', 'kepler', 'rigel', 'cosmo', 'celeste', 'ursa', 'sirius', 'lumen', 'castor',
  'naksh', 'atlas',
].map((id) => ({ id, label: titleCase(id) }))

export const VOICE_PROVIDER_OPTIONS: {
  value: VoiceProvider
  label: string
  bangla: BanglaSupport
  /** null = picked with a custom picker (Fish library). */
  voices: Choice[] | null
  defaultVoice: string
  acceptsStyle: boolean
  note: string
}[] = [
  {
    value: 'fish',
    label: 'Fish Audio',
    bangla: 'yes',
    voices: null,
    defaultVoice: '',
    acceptsStyle: false,
    note: 'Best for Bangla with a cloned native voice. Supports your own voice library.',
  },
  {
    value: 'openai',
    label: 'OpenAI',
    bangla: 'yes',
    voices: OPENAI_TTS_VOICES,
    defaultVoice: 'coral',
    acceptsStyle: true,
    note: 'gpt-4o-mini-tts. Use the speaking style to steer the accent.',
  },
  {
    value: 'google',
    label: 'Google Gemini',
    bangla: 'yes',
    voices: GEMINI_VOICES,
    defaultVoice: 'Kore',
    acceptsStyle: true,
    note: 'Gemini 2.5 Flash TTS on your Gemini key. Style steers the accent.',
  },
  {
    value: 'xai',
    label: 'xAI Grok',
    bangla: 'yes',
    voices: GROK_VOICES,
    defaultVoice: 'ara',
    acceptsStyle: false,
    note: 'Grok TTS. Speaks Bangla natively when the agent language is Bangla.',
  },
  {
    value: 'deepgram',
    label: 'Deepgram Aura',
    bangla: 'none',
    voices: DEEPGRAM_VOICES,
    defaultVoice: DEFAULT_DEEPGRAM_VOICE,
    acceptsStyle: false,
    note: 'Lowest latency, English only.',
  },
]

// --- Realtime (speech to speech) --------------------------------------------

const OPENAI_REALTIME_VOICES: Choice[] = ['marin', 'cedar', 'alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'].map(
  (id) => ({ id, label: titleCase(id) }),
)

export const REALTIME_PROVIDER_OPTIONS: {
  value: RealtimeProvider
  label: string
  product: string
  bangla: BanglaSupport
  models: Choice[]
  voices: Choice[]
  note: string
}[] = [
  {
    value: 'openai',
    label: 'OpenAI',
    product: 'OpenAI Realtime',
    bangla: 'yes',
    models: [
      { id: 'gpt-realtime', label: 'GPT Realtime' },
      { id: 'gpt-realtime-1.5', label: 'GPT Realtime 1.5' },
      { id: 'gpt-realtime-2', label: 'GPT Realtime 2' },
    ],
    voices: OPENAI_REALTIME_VOICES,
    note: 'Natural, expressive multilingual speech. Billed per audio token.',
  },
  {
    value: 'google',
    label: 'Google Gemini',
    product: 'Gemini Live',
    bangla: 'yes',
    models: [
      { id: 'gemini-2.5-flash-native-audio-preview-12-2025', label: 'Gemini 2.5 Flash native audio' },
      { id: 'gemini-3.1-flash-live-preview', label: 'Gemini 3.1 Flash Live (preview)' },
      { id: 'gemini-3.8-live', label: 'Gemini 3.8 Live' },
    ],
    voices: GEMINI_VOICES,
    note: 'Uses your Gemini key. Check the Bangla accent with a test call before going live.',
  },
  {
    value: 'xai',
    label: 'xAI Grok',
    product: 'Grok Voice',
    bangla: 'untested',
    models: [
      { id: 'grok-voice-latest', label: 'Grok Voice (latest)' },
      { id: 'grok-voice-3.0', label: 'Grok Voice 3.0' },
      { id: 'grok-voice-fast-1.0', label: 'Grok Voice Fast 1.0' },
      { id: 'grok-voice-think-fast-1.0', label: 'Grok Voice Think Fast 1.0' },
    ],
    voices: GROK_VOICES,
    note: 'Fast, expressive voice. Test a Bangla call before using it for Bangla agents.',
  },
]

export const DEFAULT_AGENT_ENGINE: AgentEngine = {
  mode: 'pipeline',
  sttProvider: 'deepgram',
  sttModel: null,
  llmProvider: 'google',
  llmModel: DEFAULT_LLM_MODEL,
  voiceProvider: 'deepgram',
  voiceModel: DEFAULT_DEEPGRAM_VOICE,
  voiceStyle: null,
  realtimeProvider: 'openai',
  realtimeModel: 'gpt-realtime',
  realtimeVoice: 'marin',
}

export const MAX_VOICE_STYLE_LENGTH = 500

export function llmModelsForProvider(provider: LlmModelProvider) {
  return LLM_MODEL_GROUPS.flatMap((group) => group.items).filter((item) => item.provider === provider)
}

export function sttOption(provider: SttProvider) {
  return STT_PROVIDER_OPTIONS.find((option) => option.value === provider) ?? STT_PROVIDER_OPTIONS[0]
}

export function voiceOption(provider: VoiceProvider) {
  return VOICE_PROVIDER_OPTIONS.find((option) => option.value === provider) ?? VOICE_PROVIDER_OPTIONS[0]
}

export function realtimeOption(provider: RealtimeProvider) {
  return REALTIME_PROVIDER_OPTIONS.find((option) => option.value === provider) ?? REALTIME_PROVIDER_OPTIONS[0]
}

export function isAgentLanguage(value: unknown): value is AgentLanguage {
  return value === 'en' || value === 'bn'
}

export function llmProviderLabel(provider: string): string {
  return LLM_PROVIDER_OPTIONS.find((option) => option.value === provider)?.label ?? provider
}

export function deepgramVoiceLabel(voiceId: string): string | null {
  return DEEPGRAM_VOICES.find((voice) => voice.id === voiceId)?.label ?? null
}

/** Provider keys a call needs with this engine (for key warnings). */
export function providersUsedBy(engine: AgentEngine): string[] {
  if (engine.mode === 'realtime') return [engine.realtimeProvider]
  return Array.from(new Set([engine.sttProvider, engine.llmProvider, engine.voiceProvider]))
}

/** True when the speaking stage can produce Bangla (used by the Speak page hint). */
export function engineSpeaksBangla(engine: AgentEngine): boolean {
  const support =
    engine.mode === 'realtime' ? realtimeOption(engine.realtimeProvider).bangla : voiceOption(engine.voiceProvider).bangla
  return support !== 'none'
}

export type EngineValidation = { ok: true; engine: AgentEngine } | { ok: false; error: string }

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const inChoices = (choices: Choice[], id: string) => choices.some((choice) => choice.id === id)

/** Boundary guard for engine input from forms/actions. Unknown models fall back to defaults. */
export function validateAgentEngine(input: Partial<Record<keyof AgentEngine, unknown>>): EngineValidation {
  const mode: EngineMode = input.mode === 'realtime' ? 'realtime' : 'pipeline'

  const llm = LLM_PROVIDER_OPTIONS.find((option) => option.value === input.llmProvider)
  if (!llm) return { ok: false, error: 'Unknown language model provider.' }
  if (!llm.enabled) return { ok: false, error: `${llm.label} is not available yet.` }
  const requestedModel = str(input.llmModel)
  const isKnownModel =
    llmModelsForProvider(llm.value).some((model) => model.id === requestedModel) ||
    (llm.value === 'openrouter' && isOpenRouterModelId(requestedModel)) ||
    (llm.value === 'xai' && isXaiModelId(requestedModel))
  const llmModel = isKnownModel ? requestedModel : defaultModelForLlmProvider(llm.value)

  const stt = STT_PROVIDER_OPTIONS.find((option) => option.value === input.sttProvider)
  if (!stt) return { ok: false, error: 'Unknown speech-to-text provider.' }
  const requestedSttModel = str(input.sttModel)
  const sttModel = requestedSttModel && inChoices(stt.models, requestedSttModel) ? requestedSttModel : stt.models[0].id || null

  const voice = VOICE_PROVIDER_OPTIONS.find((option) => option.value === input.voiceProvider)
  if (!voice) return { ok: false, error: 'Unknown voice provider.' }
  let voiceModel = str(input.voiceModel)
  if (voice.voices) {
    if (!inChoices(voice.voices, voiceModel)) {
      if (voice.value === 'deepgram') return { ok: false, error: 'Pick a Deepgram voice.' }
      voiceModel = voice.defaultVoice
    }
  } else if (!/^[A-Za-z0-9_-]{6,100}$/u.test(voiceModel)) {
    return { ok: false, error: 'Pick a Fish voice.' }
  }

  const realtime = REALTIME_PROVIDER_OPTIONS.find((option) => option.value === input.realtimeProvider)
  if (!realtime) return { ok: false, error: 'Unknown realtime provider.' }
  const realtimeModel = inChoices(realtime.models, str(input.realtimeModel)) ? str(input.realtimeModel) : realtime.models[0].id
  const realtimeVoice = inChoices(realtime.voices, str(input.realtimeVoice)) ? str(input.realtimeVoice) : realtime.voices[0].id

  const voiceStyle = str(input.voiceStyle).slice(0, MAX_VOICE_STYLE_LENGTH) || null

  return {
    ok: true,
    engine: {
      mode,
      sttProvider: stt.value,
      sttModel,
      llmProvider: llm.value,
      llmModel,
      voiceProvider: voice.value,
      voiceModel,
      voiceStyle,
      realtimeProvider: realtime.value,
      realtimeModel,
      realtimeVoice,
    },
  }
}

function choiceLabel(choices: Choice[] | null, id: string): string | null {
  return choices?.find((choice) => choice.id === id)?.label ?? null
}

/**
 * Short human summary. In realtime mode `llm`/`voice` describe the realtime model and voice so
 * existing callers keep working. Fish voice titles are resolved by callers.
 */
export function describeEngine(engine: AgentEngine, fishVoiceTitle?: string | null) {
  if (engine.mode === 'realtime') {
    const option = realtimeOption(engine.realtimeProvider)
    return {
      mode: 'realtime' as const,
      llm: choiceLabel(option.models, engine.realtimeModel) ?? engine.realtimeModel,
      llmProvider: option.product,
      voice: choiceLabel(option.voices, engine.realtimeVoice) ?? engine.realtimeVoice,
      voiceProvider: option.product,
      stt: option.product,
      sttProvider: option.label,
    }
  }
  const voice = voiceOption(engine.voiceProvider)
  const stt = sttOption(engine.sttProvider)
  return {
    mode: 'pipeline' as const,
    llm: labelForLlmModelId(engine.llmModel),
    llmProvider: llmProviderLabel(engine.llmProvider),
    voice:
      engine.voiceProvider === 'fish'
        ? fishVoiceTitle || `Fish voice ${engine.voiceModel.slice(0, 8)}…`
        : choiceLabel(voice.voices, engine.voiceModel) ?? engine.voiceModel,
    voiceProvider: voice.label,
    stt: choiceLabel(stt.models, engine.sttModel ?? '') ?? stt.models[0].label,
    sttProvider: stt.label,
  }
}
