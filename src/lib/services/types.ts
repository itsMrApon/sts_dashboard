/** Shared (client + server) types, defaults and sanitizers for the website services. */

export type WebServiceId = 'chat' | 'speak' | 'form' | 'wizard'

export type ChatServiceConfig = {
  greeting: string
  suggestions: string[]
  maxMessageLength: number
  /** Return product / CTA links with replies so the site can render buttons. */
  includeLinks: boolean
}

export type SpeakServiceConfig = {
  maxCallMinutes: number
}

export type FormFieldType = 'text' | 'email' | 'phone' | 'textarea' | 'select'

export type FormField = {
  id: string
  label: string
  type: FormFieldType
  required: boolean
  options: string[]
}

export type FormServiceConfig = {
  title: string
  description: string
  fields: FormField[]
  consentText: string
  submitLabel: string
  successMessage: string
  /** Empty = the business owner's account email. */
  notifyEmail: string
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
}

export const DEFAULT_SPEAK_CONFIG: SpeakServiceConfig = { maxCallMinutes: 5 }

export function fieldId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export const DEFAULT_FORM_CONFIG: FormServiceConfig = {
  title: 'Request a callback',
  description: "Leave your details and we'll get back to you shortly.",
  fields: [
    { id: 'name', label: 'Name', type: 'text', required: false, options: [] },
    { id: 'phone', label: 'Phone', type: 'phone', required: true, options: [] },
    { id: 'note', label: 'How can we help?', type: 'textarea', required: false, options: [] },
  ],
  consentText: 'I agree to be contacted about my request.',
  submitLabel: 'Send',
  successMessage: "Thanks! We'll be in touch soon.",
  notifyEmail: '',
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
    includeLinks: typeof input.includeLinks === 'boolean' ? input.includeLinks : DEFAULT_CHAT_CONFIG.includeLinks,
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
  }
}

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
