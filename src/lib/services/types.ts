/** Shared (client + server) types, defaults and sanitizers for the website services. */
import { isWizardShape, isWizardThemeId, type WizardShape, type WizardThemeId } from '@/lib/wizard/types'

export type WebServiceId = 'chat' | 'speak' | 'form' | 'wizard'

/** Brand colour for hosted pages and the SDK (`accent` in the payload). */
export const ACCENTS = [
  { id: 'violet', label: 'Violet', hex: '#8b5cf6' },
  { id: 'blue', label: 'Blue', hex: '#3b82f6' },
  { id: 'emerald', label: 'Emerald', hex: '#10b981' },
  { id: 'amber', label: 'Amber', hex: '#f59e0b' },
  { id: 'rose', label: 'Rose', hex: '#f43f5e' },
  { id: 'slate', label: 'Slate', hex: '#64748b' },
] as const
export type AccentId = (typeof ACCENTS)[number]['id']
export const accentHex = (id: AccentId): string => ACCENTS.find((accent) => accent.id === id)?.hex ?? ACCENTS[0].hex

/** How the AI talks (chat + voice). Turned into instructions on top of the agent's own prompt. */
export const TONES = [
  { id: 'friendly', label: 'Friendly', hint: 'Warm and helpful' },
  { id: 'professional', label: 'Professional', hint: 'Polished and precise' },
  { id: 'casual', label: 'Casual', hint: 'Relaxed, like a friend' },
  { id: 'enthusiastic', label: 'Enthusiastic', hint: 'Upbeat and energetic' },
] as const
export type Tone = (typeof TONES)[number]['id']

export const REPLY_LENGTHS = [
  { id: 'short', label: 'Short', hint: '1–2 sentences' },
  { id: 'balanced', label: 'Balanced', hint: 'A short paragraph' },
  { id: 'detailed', label: 'Detailed', hint: 'Full explanations' },
] as const
export type ReplyLength = (typeof REPLY_LENGTHS)[number]['id']

export const REPLY_LANGUAGES = [
  { id: 'auto', label: 'Match the visitor' },
  { id: 'en', label: 'English' },
  { id: 'bn', label: 'বাংলা (Bangla)' },
] as const
export type ReplyLanguage = (typeof REPLY_LANGUAGES)[number]['id']

export type ChatServiceConfig = {
  greeting: string
  suggestions: string[]
  maxMessageLength: number
  /** Return product / CTA links with replies so the site can render buttons. */
  includeLinks: boolean
  /** Name shown on the chat header. Empty = the agent's name. */
  assistantName: string
  tone: Tone
  replyLength: ReplyLength
  replyLanguage: ReplyLanguage
  inputPlaceholder: string
  /** Shown to visitors when the AI can't answer (no key, provider down). */
  fallbackMessage: string
  /** Show the business's WhatsApp / Messenger / phone so visitors can reach a person. */
  showHumanHandoff: boolean
  accent: AccentId
}

export const END_WARNINGS = [0, 30, 60] as const
export type EndWarningSeconds = (typeof END_WARNINGS)[number]

export type SpeakServiceConfig = {
  maxCallMinutes: number
  /** Name the voice AI introduces itself with. Empty = the agent's own prompt decides. */
  assistantName: string
  tone: Tone
  replyLength: ReplyLength
  /** The orb on the hosted call page. */
  orbTheme: WizardThemeId
  orbShape: WizardShape
  callButtonLabel: string
  /** Warn the caller this many seconds before the call limit (0 = no warning). */
  endWarningSeconds: EndWarningSeconds
  showHumanHandoff: boolean
}

export type FormFieldType = 'text' | 'email' | 'phone' | 'textarea' | 'select'

export type FormField = {
  id: string
  label: string
  type: FormFieldType
  required: boolean
  options: string[]
  placeholder: string
  /** Small text under the field. */
  helpText: string
}

export type FormLayout = 'single' | 'double'

export type FormServiceConfig = {
  title: string
  description: string
  fields: FormField[]
  consentText: string
  submitLabel: string
  successMessage: string
  /** Empty = the business owner's account email. */
  notifyEmail: string
  accent: AccentId
  /** Two columns puts short fields side by side (long text and dropdowns stay full width). */
  layout: FormLayout
  /** Send visitors here after a successful submit (https only). Empty = show the success message. */
  redirectUrl: string
  /** Hidden trap field that bots fill in; those submissions are dropped. */
  spamProtection: boolean
  /** After submitting, offer "Chat with us" (when Chat AI is on). */
  showChatLink: boolean
}

export type ServiceState<T> = { enabled: boolean; config: T }

/** Deepgram voices for Speak AI (read by the LiveKit worker). Asteria is the worker's long-standing default. */
export const SPEAK_VOICES: { id: string; label: string }[] = [
  { id: 'aura-asteria-en', label: 'Asteria — default, female' },
  { id: 'aura-2-thalia-en', label: 'Thalia — warm, female' },
  { id: 'aura-2-andromeda-en', label: 'Andromeda — calm, female' },
  { id: 'aura-2-apollo-en', label: 'Apollo — confident, male' },
  { id: 'aura-2-orion-en', label: 'Orion — friendly, male' },
]

export const SERVICE_LIMITS = {
  greeting: 300,
  suggestion: 80,
  maxSuggestions: 6,
  maxMessageLengthMin: 100,
  maxMessageLengthMax: 4000,
  maxCallMinutesMin: 1,
  maxCallMinutesMax: 30,
  formTitle: 120,
  formDescription: 400,
  fieldLabel: 80,
  maxFields: 12,
  maxOptions: 12,
  option: 60,
  consent: 400,
  submitLabel: 40,
  successMessage: 300,
  email: 200,
  fieldValue: 2000,
  assistantName: 40,
  placeholder: 80,
  helpText: 160,
  fallbackMessage: 300,
  buttonLabel: 40,
  url: 500,
} as const

export const FORM_FIELD_TYPES: { id: FormFieldType; label: string }[] = [
  { id: 'text', label: 'Text' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'textarea', label: 'Long text' },
  { id: 'select', label: 'Dropdown' },
]

export const DEFAULT_CHAT_CONFIG: ChatServiceConfig = {
  greeting: 'Hi! How can I help you today?',
  suggestions: ['What services do you offer?', 'How much does it cost?', 'How can I contact you?'],
  maxMessageLength: 1000,
  includeLinks: true,
  assistantName: '',
  tone: 'friendly',
  replyLength: 'balanced',
  replyLanguage: 'auto',
  inputPlaceholder: 'Type your message…',
  fallbackMessage: "Sorry, I can't answer right now. Please try again in a moment.",
  showHumanHandoff: true,
  accent: 'violet',
}

export const DEFAULT_SPEAK_CONFIG: SpeakServiceConfig = {
  maxCallMinutes: 5,
  assistantName: '',
  tone: 'friendly',
  replyLength: 'short',
  orbTheme: 'aurora',
  orbShape: 'circle',
  callButtonLabel: 'Talk to us',
  endWarningSeconds: 30,
  showHumanHandoff: true,
}

export function fieldId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export const DEFAULT_FORM_CONFIG: FormServiceConfig = {
  title: 'Request a callback',
  description: "Leave your details and we'll get back to you shortly.",
  fields: [
    { id: 'name', label: 'Name', type: 'text', required: false, options: [], placeholder: 'Your name', helpText: '' },
    { id: 'phone', label: 'Phone', type: 'phone', required: true, options: [], placeholder: '', helpText: '' },
    {
      id: 'note',
      label: 'How can we help?',
      type: 'textarea',
      required: false,
      options: [],
      placeholder: 'A few words about what you need',
      helpText: '',
    },
  ],
  consentText: 'I agree to be contacted about my request.',
  submitLabel: 'Send',
  successMessage: "Thanks! We'll be in touch soon.",
  notifyEmail: '',
  accent: 'violet',
  layout: 'single',
  redirectUrl: '',
  spamProtection: true,
  showChatLink: true,
}

function text(value: unknown, max: number, fallback = ''): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback
}

function int(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function oneOf<T extends string | number>(value: unknown, allowed: readonly { id: T }[] | readonly T[], fallback: T): T {
  const ids = (allowed as readonly unknown[]).map((item) => (typeof item === 'object' && item ? (item as { id: T }).id : item))
  return ids.includes(value) ? (value as T) : fallback
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/** Absolute https link (or a same-site path), or empty. */
function safeLink(value: unknown): string {
  const link = text(value, SERVICE_LIMITS.url)
  if (!link) return ''
  if (link.startsWith('/') && !link.startsWith('//')) return link
  try {
    const url = new URL(link)
    return url.protocol === 'https:' ? url.toString() : ''
  } catch {
    return ''
  }
}

/** All sanitizers preserve Bangla Unicode — only trim + length clamp. */
export function sanitizeChatConfig(raw: unknown): ChatServiceConfig {
  const input = record(raw)
  const suggestions = Array.isArray(input.suggestions)
    ? input.suggestions
        .map((item) => text(item, SERVICE_LIMITS.suggestion))
        .filter(Boolean)
        .slice(0, SERVICE_LIMITS.maxSuggestions)
    : DEFAULT_CHAT_CONFIG.suggestions
  return {
    greeting: text(input.greeting, SERVICE_LIMITS.greeting) || DEFAULT_CHAT_CONFIG.greeting,
    suggestions,
    maxMessageLength: int(
      input.maxMessageLength,
      SERVICE_LIMITS.maxMessageLengthMin,
      SERVICE_LIMITS.maxMessageLengthMax,
      DEFAULT_CHAT_CONFIG.maxMessageLength,
    ),
    includeLinks: bool(input.includeLinks, DEFAULT_CHAT_CONFIG.includeLinks),
    assistantName: text(input.assistantName, SERVICE_LIMITS.assistantName),
    tone: oneOf(input.tone, TONES, DEFAULT_CHAT_CONFIG.tone),
    replyLength: oneOf(input.replyLength, REPLY_LENGTHS, DEFAULT_CHAT_CONFIG.replyLength),
    replyLanguage: oneOf(input.replyLanguage, REPLY_LANGUAGES, DEFAULT_CHAT_CONFIG.replyLanguage),
    inputPlaceholder: text(input.inputPlaceholder, SERVICE_LIMITS.placeholder) || DEFAULT_CHAT_CONFIG.inputPlaceholder,
    fallbackMessage: text(input.fallbackMessage, SERVICE_LIMITS.fallbackMessage) || DEFAULT_CHAT_CONFIG.fallbackMessage,
    showHumanHandoff: bool(input.showHumanHandoff, DEFAULT_CHAT_CONFIG.showHumanHandoff),
    accent: oneOf(input.accent, ACCENTS, DEFAULT_CHAT_CONFIG.accent),
  }
}

export function sanitizeSpeakConfig(raw: unknown): SpeakServiceConfig {
  const input = record(raw)
  return {
    maxCallMinutes: int(
      input.maxCallMinutes,
      SERVICE_LIMITS.maxCallMinutesMin,
      SERVICE_LIMITS.maxCallMinutesMax,
      DEFAULT_SPEAK_CONFIG.maxCallMinutes,
    ),
    assistantName: text(input.assistantName, SERVICE_LIMITS.assistantName),
    tone: oneOf(input.tone, TONES, DEFAULT_SPEAK_CONFIG.tone),
    replyLength: oneOf(input.replyLength, REPLY_LENGTHS, DEFAULT_SPEAK_CONFIG.replyLength),
    orbTheme: isWizardThemeId(input.orbTheme) ? input.orbTheme : DEFAULT_SPEAK_CONFIG.orbTheme,
    orbShape: isWizardShape(input.orbShape) ? input.orbShape : DEFAULT_SPEAK_CONFIG.orbShape,
    callButtonLabel: text(input.callButtonLabel, SERVICE_LIMITS.buttonLabel) || DEFAULT_SPEAK_CONFIG.callButtonLabel,
    endWarningSeconds: oneOf(input.endWarningSeconds, END_WARNINGS, DEFAULT_SPEAK_CONFIG.endWarningSeconds),
    showHumanHandoff: bool(input.showHumanHandoff, DEFAULT_SPEAK_CONFIG.showHumanHandoff),
  }
}

function isFieldType(value: unknown): value is FormFieldType {
  return FORM_FIELD_TYPES.some((type) => type.id === value)
}

export function sanitizeFormConfig(raw: unknown): FormServiceConfig {
  const input = record(raw)
  const seen = new Set<string>()
  const fields: FormField[] = []
  const rawFields = Array.isArray(input.fields) ? input.fields : DEFAULT_FORM_CONFIG.fields
  for (const item of rawFields.slice(0, SERVICE_LIMITS.maxFields)) {
    const field = record(item)
    let id = text(field.id, 32).replace(/[^a-zA-Z0-9_-]/g, '')
    if (!id || seen.has(id)) id = fieldId()
    seen.add(id)
    const label = text(field.label, SERVICE_LIMITS.fieldLabel)
    if (!label) continue
    const type = isFieldType(field.type) ? field.type : 'text'
    fields.push({
      id,
      label,
      type,
      required: Boolean(field.required),
      options:
        type === 'select' && Array.isArray(field.options)
          ? field.options
              .map((option) => text(option, SERVICE_LIMITS.option))
              .filter(Boolean)
              .slice(0, SERVICE_LIMITS.maxOptions)
          : [],
      placeholder: text(field.placeholder, SERVICE_LIMITS.placeholder),
      helpText: text(field.helpText, SERVICE_LIMITS.helpText),
    })
  }
  const notifyEmail = text(input.notifyEmail, SERVICE_LIMITS.email)
  return {
    title: text(input.title, SERVICE_LIMITS.formTitle) || DEFAULT_FORM_CONFIG.title,
    // Missing (never saved) → default; present but empty → creator cleared it on purpose.
    description:
      'description' in input ? text(input.description, SERVICE_LIMITS.formDescription) : DEFAULT_FORM_CONFIG.description,
    fields: fields.length ? fields : DEFAULT_FORM_CONFIG.fields,
    consentText: 'consentText' in input ? text(input.consentText, SERVICE_LIMITS.consent) : DEFAULT_FORM_CONFIG.consentText,
    submitLabel: text(input.submitLabel, SERVICE_LIMITS.submitLabel) || DEFAULT_FORM_CONFIG.submitLabel,
    successMessage: text(input.successMessage, SERVICE_LIMITS.successMessage) || DEFAULT_FORM_CONFIG.successMessage,
    notifyEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail) ? notifyEmail : '',
    accent: oneOf(input.accent, ACCENTS, DEFAULT_FORM_CONFIG.accent),
    layout: input.layout === 'double' ? 'double' : 'single',
    redirectUrl: safeLink(input.redirectUrl),
    spamProtection: bool(input.spamProtection, DEFAULT_FORM_CONFIG.spamProtection),
    showChatLink: bool(input.showChatLink, DEFAULT_FORM_CONFIG.showChatLink),
  }
}

/** Name of the hidden trap field (spam protection). Real visitors never see or fill it. */
export const FORM_HONEYPOT_FIELD = 'company_website'

export type FormValues = Record<string, string>

/** Validates visitor input against the form schema. Returns cleaned values or the first error. */
export function validateFormValues(
  config: FormServiceConfig,
  raw: unknown,
  consentGiven: boolean,
): { ok: true; values: FormValues } | { ok: false; error: string; fieldId?: string } {
  const input = record(raw)
  const values: FormValues = {}
  for (const field of config.fields) {
    const value = text(input[field.id], SERVICE_LIMITS.fieldValue)
    if (!value) {
      if (field.required) return { ok: false, error: `${field.label} is required`, fieldId: field.id }
      continue
    }
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return { ok: false, error: `${field.label} must be a valid email`, fieldId: field.id }
    }
    if (field.type === 'phone' && !/^[+\d][\d\s()-]{5,}$/.test(value)) {
      return { ok: false, error: `${field.label} must be a valid phone number`, fieldId: field.id }
    }
    if (field.type === 'select' && field.options.length && !field.options.includes(value)) {
      return { ok: false, error: `Choose a valid ${field.label}`, fieldId: field.id }
    }
    values[field.id] = value
  }
  if (config.consentText && !consentGiven) return { ok: false, error: 'Please accept the consent checkbox' }
  if (Object.keys(values).length === 0) return { ok: false, error: 'Fill in at least one field' }
  return { ok: true, values }
}
