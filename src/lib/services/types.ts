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
  /** Documents the chat may ask the visitor to upload (saved to the creator's Google Drive). */
  documentRequests: ChatDocumentRequest[]
  accent: AccentId
}

export const DOCUMENT_ACCEPT = ['pdf', 'image', 'any'] as const
export type DocumentAccept = (typeof DOCUMENT_ACCEPT)[number]

/** "Receipt, PDF or photo, ask after payment": one document the chat may ask for. */
export type ChatDocumentRequest = {
  id: string
  /** What to ask for, as the visitor will read it ("Payment receipt", "রসিদ"). */
  name: string
  /** When to ask, in the creator's words ("after they say they paid"). */
  when: string
  accept: DocumentAccept
}

export const END_WARNINGS = [0, 30, 60] as const
export type EndWarningSeconds = (typeof END_WARNINGS)[number]

/** How fast the voice speaks (TTS speed multiplier). 1 = the voice's normal pace. */
export const SPEAKING_SPEEDS = [
  { id: 0.8, label: 'Slower' },
  { id: 0.9, label: 'Slow' },
  { id: 1, label: 'Normal' },
  { id: 1.1, label: 'Fast' },
  { id: 1.2, label: 'Faster' },
] as const
export type SpeakingSpeed = (typeof SPEAKING_SPEEDS)[number]['id']

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
  /** Voice pace on calls (Fish, OpenAI and Deepgram voices; Gemini voices get a pace hint). */
  speakingSpeed: SpeakingSpeed
  showHumanHandoff: boolean
}

/** `select` is the multiple-choice question (A/B/C cards); the id is kept so saved forms still load. */
export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'phone'
  | 'number'
  | 'url'
  | 'date'
  | 'select'
  | 'yesno'
  | 'rating'

export type RatingScale = 5 | 10

export type FormField = {
  id: string
  /** The question, shown large on its own screen. */
  label: string
  type: FormFieldType
  required: boolean
  /** Choices for `select`. */
  options: string[]
  /** `select` only: visitors may pick several choices. */
  multiple: boolean
  /** `rating` only: 5 = 1–5 stars, 10 = a 0–10 scale. */
  scale: RatingScale
  placeholder: string
  /** Small text under the question. */
  helpText: string
}

export type FormTheme = 'light' | 'dark'

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
  /** Background of the full-screen hosted form. */
  theme: FormTheme
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
  { id: 'text', label: 'Short text' },
  { id: 'textarea', label: 'Long text' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'select', label: 'Multiple choice' },
  { id: 'yesno', label: 'Yes / No' },
  { id: 'rating', label: 'Rating' },
  { id: 'date', label: 'Date' },
  { id: 'number', label: 'Number' },
  { id: 'url', label: 'Website' },
]

/** A blank question with every property set (new fields in the editor, AI drafts). */
export function newFormField(partial: Partial<FormField> = {}): FormField {
  return {
    id: fieldId(),
    label: 'New question',
    type: 'text',
    required: false,
    options: [],
    multiple: false,
    scale: 5,
    placeholder: '',
    helpText: '',
    ...partial,
  }
}

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
  documentRequests: [],
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
  speakingSpeed: 1,
  showHumanHandoff: true,
}

export function fieldId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export const DEFAULT_FORM_CONFIG: FormServiceConfig = {
  title: 'Request a callback',
  description: "Leave your details and we'll get back to you shortly.",
  fields: [
    {
      id: 'name',
      label: "What's your name?",
      type: 'text',
      required: false,
      options: [],
      multiple: false,
      scale: 5,
      placeholder: 'Type your answer here…',
      helpText: '',
    },
    {
      id: 'phone',
      label: "What's the best number to reach you?",
      type: 'phone',
      required: true,
      options: [],
      multiple: false,
      scale: 5,
      placeholder: '',
      helpText: '',
    },
    {
      id: 'note',
      label: 'How can we help?',
      type: 'textarea',
      required: false,
      options: [],
      multiple: false,
      scale: 5,
      placeholder: 'A few words about what you need',
      helpText: '',
    },
  ],
  consentText: 'I agree to be contacted about my request.',
  submitLabel: 'Send',
  successMessage: "Thanks! We'll be in touch soon.",
  notifyEmail: '',
  accent: 'violet',
  theme: 'light',
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
    documentRequests: sanitizeDocumentRequests(input.documentRequests),
    accent: oneOf(input.accent, ACCENTS, DEFAULT_CHAT_CONFIG.accent),
  }
}

export const DOCUMENT_REQUEST_LIMITS = { max: 5, name: 60, when: 200 } as const

function sanitizeDocumentRequests(raw: unknown): ChatDocumentRequest[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item, index) => {
      const entry = record(item)
      const name = text(entry.name, DOCUMENT_REQUEST_LIMITS.name)
      if (!name) return null
      const id = text(entry.id, 40) || `doc-${index + 1}`
      return {
        id,
        name,
        when: text(entry.when, DOCUMENT_REQUEST_LIMITS.when),
        accept: oneOf(entry.accept, DOCUMENT_ACCEPT, 'any'),
      }
    })
    .filter((item): item is ChatDocumentRequest => item !== null)
    .slice(0, DOCUMENT_REQUEST_LIMITS.max)
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
    speakingSpeed: oneOf(input.speakingSpeed, SPEAKING_SPEEDS, DEFAULT_SPEAK_CONFIG.speakingSpeed),
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
    const options =
      type === 'select' && Array.isArray(field.options)
        ? [...new Set(field.options.map((option) => text(option, SERVICE_LIMITS.option)).filter(Boolean))].slice(
            0,
            SERVICE_LIMITS.maxOptions,
          )
        : []
    fields.push({
      id,
      label,
      // A choice question needs choices; without any it falls back to short text.
      type: type === 'select' && options.length === 0 ? 'text' : type,
      required: Boolean(field.required),
      options,
      multiple: type === 'select' && field.multiple === true,
      scale: field.scale === 10 ? 10 : 5,
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
    notifyEmail: EMAIL_RE.test(notifyEmail) ? notifyEmail : '',
    accent: oneOf(input.accent, ACCENTS, DEFAULT_FORM_CONFIG.accent),
    theme: input.theme === 'dark' ? 'dark' : 'light',
    redirectUrl: safeLink(input.redirectUrl),
    spamProtection: bool(input.spamProtection, DEFAULT_FORM_CONFIG.spamProtection),
    showChatLink: bool(input.showChatLink, DEFAULT_FORM_CONFIG.showChatLink),
  }
}

/** Name of the hidden trap field (spam protection). Real visitors never see or fill it. */
export const FORM_HONEYPOT_FIELD = 'company_website'

/** Cleaned answers, one string per question (several choices joined with ", "). */
export type FormValues = Record<string, string>

/** What a visitor sends: a string per question, or a list for multi-answer choice questions. */
export type FormAnswer = string | string[]
export type FormAnswers = Record<string, FormAnswer>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[+\d][\d\s()-]{5,}$/
const NUMBER_RE = /^-?\d+([.,]\d+)?$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Adds https:// to a bare domain ("acme.com") and checks it is a real web address. */
function normalizeWebsite(value: string): string | null {
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try {
    const url = new URL(candidate)
    return url.hostname.includes('.') ? url.toString() : null
  } catch {
    return null
  }
}

/** True for a filled-in answer ('' and [] count as empty). */
export function hasAnswer(answer: FormAnswer | undefined): boolean {
  return Array.isArray(answer) ? answer.length > 0 : Boolean(answer?.trim())
}

/**
 * Checks one answer against its question. Used by the step-by-step form (before moving on)
 * and by the server, so both give the same message. Bangla text is kept as typed.
 */
export function validateFieldAnswer(
  field: FormField,
  raw: unknown,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const list = Array.isArray(raw) ? raw : null
  const value = list ? '' : text(raw, SERVICE_LIMITS.fieldValue)
  if (!(list ? list.length : value)) {
    return field.required ? { ok: false, error: 'Please fill this in' } : { ok: true, value: null }
  }

  switch (field.type) {
    case 'email':
      return EMAIL_RE.test(value) ? { ok: true, value } : { ok: false, error: 'Enter a valid email, like name@example.com' }
    case 'phone':
      return PHONE_RE.test(value) ? { ok: true, value } : { ok: false, error: 'Enter a valid phone number' }
    case 'number':
      return NUMBER_RE.test(value) ? { ok: true, value } : { ok: false, error: 'Enter a number' }
    case 'url': {
      const website = normalizeWebsite(value)
      return website ? { ok: true, value: website } : { ok: false, error: 'Enter a website, like example.com' }
    }
    case 'date':
      return DATE_RE.test(value) && !Number.isNaN(Date.parse(value))
        ? { ok: true, value }
        : { ok: false, error: 'Pick a date' }
    case 'yesno':
      return value === 'Yes' || value === 'No' ? { ok: true, value } : { ok: false, error: 'Choose Yes or No' }
    case 'rating': {
      const score = Number(value)
      const min = field.scale === 10 ? 0 : 1
      return Number.isInteger(score) && score >= min && score <= field.scale
        ? { ok: true, value: `${score} / ${field.scale}` }
        : { ok: false, error: 'Pick a rating' }
    }
    case 'select': {
      const picked = (list ?? [value]).map((item) => text(item, SERVICE_LIMITS.option))
      if (!field.multiple && picked.length > 1) return { ok: false, error: 'Choose one option' }
      if (picked.some((item) => !field.options.includes(item))) return { ok: false, error: 'Choose one of the options' }
      return { ok: true, value: [...new Set(picked)].join(', ') }
    }
    default:
      return { ok: true, value }
  }
}

/** Validates visitor input against the form schema. Returns cleaned values or the first error. */
export function validateFormValues(
  config: FormServiceConfig,
  raw: unknown,
  consentGiven: boolean,
): { ok: true; values: FormValues } | { ok: false; error: string; fieldId?: string } {
  const input = record(raw)
  const values: FormValues = {}
  for (const field of config.fields) {
    const checked = validateFieldAnswer(field, input[field.id])
    if (!checked.ok) return { ok: false, error: `${field.label}: ${checked.error}`, fieldId: field.id }
    if (checked.value) values[field.id] = checked.value
  }
  if (config.consentText && !consentGiven) return { ok: false, error: 'Please accept the consent checkbox' }
  if (Object.keys(values).length === 0) return { ok: false, error: 'Answer at least one question' }
  return { ok: true, values }
}
