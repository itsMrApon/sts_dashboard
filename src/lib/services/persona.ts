/**
 * Turns a service's style settings (tone, reply length, language, name) into instructions that
 * sit on top of the agent's own prompt. The agent's prompt stays the source of truth for facts;
 * these only shape how it talks on that service.
 */
import type { ChatServiceConfig, ReplyLength, SpeakServiceConfig, Tone } from './types'

const TONE_RULE: Record<Tone, string> = {
  friendly: 'Sound warm, approachable and helpful.',
  professional: 'Sound polished, precise and courteous. No slang or emoji.',
  casual: 'Sound relaxed and conversational, like a helpful friend.',
  enthusiastic: 'Sound upbeat and energetic, without overselling.',
}

const CHAT_LENGTH_RULE: Record<ReplyLength, string> = {
  short: 'Keep replies to one or two sentences unless the visitor asks for more.',
  balanced: 'Keep replies to a short paragraph; use a brief list only when it helps.',
  detailed: 'Give complete, well-structured answers with the useful details.',
}

const VOICE_LENGTH_RULE: Record<ReplyLength, string> = {
  short: 'Speak in one or two short sentences per turn.',
  balanced: 'Keep each spoken turn to two or three sentences.',
  detailed: 'You may explain in more depth, but stay easy to follow by ear.',
}

export function chatStyleInstruction(config: ChatServiceConfig): string {
  const lines = ['Website chat style:', TONE_RULE[config.tone], CHAT_LENGTH_RULE[config.replyLength]]
  if (config.assistantName) lines.push(`Your name is ${config.assistantName}.`)
  if (config.replyLanguage === 'en') lines.push('Always reply in English.')
  // Bangla is kept in Bengali script end-to-end (never transliterated).
  if (config.replyLanguage === 'bn') lines.push('Always reply in natural Bangla (Bengali script), keeping brand names as-is.')
  if (config.replyLanguage === 'auto') lines.push("Reply in the visitor's language (English or Bangla).")
  return lines.join('\n')
}

export function speakStyleInstruction(config: SpeakServiceConfig): string {
  const lines = ['Voice call style:', TONE_RULE[config.tone], VOICE_LENGTH_RULE[config.replyLength]]
  if (config.assistantName) lines.push(`Introduce yourself as ${config.assistantName} when it fits.`)
  return lines.join('\n')
}
