/** Shared (client + server) types and limits for the voice Wizard tour. */

export type WizardLanguage = 'en' | 'bn'
export type WizardShape = 'circle' | 'diamond' | 'daisy' | 'metaballs'
export type WizardThemeId = 'obsidian' | 'aurora' | 'ember' | 'pearl'

export type VoiceWizardStep = {
  id: string
  heading: string
  body: string
  /** Spoken line. Falls back to heading + body when empty. */
  narration: string
  ctaLabel: string
  ctaUrl: string
  /** Website SDK: `data-sts-step` value of the section to scroll to on the creator's site. */
  target: string
}

export type WizardTheme = {
  label: string
  isLight: boolean
  colors: string[]
  colorBack: string
  colorInner: string
}

export const WIZARD_LIMITS = {
  maxSteps: 12,
  heading: 120,
  body: 600,
  narration: 600,
  ctaLabel: 40,
  ctaUrl: 500,
  target: 48,
  name: 120,
  guideName: 40,
} as const

export const WIZARD_THEMES: Record<WizardThemeId, WizardTheme> = {
  obsidian: {
    label: 'Obsidian',
    isLight: false,
    colors: ['#71717a', '#f4f4f5'],
    colorBack: '#09090b',
    colorInner: '#18181b',
  },
  aurora: {
    label: 'Aurora',
    isLight: false,
    colors: ['#6366f1', '#22d3ee', '#a855f7'],
    colorBack: '#05060f',
    colorInner: '#0f172a',
  },
  ember: {
    label: 'Ember',
    isLight: false,
    colors: ['#f97316', '#fde68a'],
    colorBack: '#0c0a09',
    colorInner: '#1c1917',
  },
  pearl: {
    label: 'Pearl',
    isLight: true,
    colors: ['#333333', '#e7e6df'],
    colorBack: '#f0efea',
    colorInner: '#fafaf5',
  },
}

export const WIZARD_SHAPES: { id: WizardShape; label: string }[] = [
  { id: 'circle', label: 'Orb' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'daisy', label: 'Daisy' },
  { id: 'metaballs', label: 'Metaballs' },
]

/** Deepgram Aura-2 voices (English). Bangla tours use the visitor's browser voice. */
export const WIZARD_VOICES: { id: string; label: string }[] = [
  { id: 'aura-2-thalia-en', label: 'Thalia — warm, female' },
  { id: 'aura-2-andromeda-en', label: 'Andromeda — calm, female' },
  { id: 'aura-2-apollo-en', label: 'Apollo — confident, male' },
  { id: 'aura-2-orion-en', label: 'Orion — friendly, male' },
]

export const WIZARD_LANGUAGES: { id: WizardLanguage; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'bn', label: 'বাংলা (Bangla)' },
]

export function resolveTheme(themeId: string): WizardTheme {
  return WIZARD_THEMES[themeId as WizardThemeId] ?? WIZARD_THEMES.obsidian
}

export function isWizardLanguage(value: unknown): value is WizardLanguage {
  return value === 'en' || value === 'bn'
}

export function isWizardShape(value: unknown): value is WizardShape {
  return WIZARD_SHAPES.some((shape) => shape.id === value)
}

export function isWizardThemeId(value: unknown): value is WizardThemeId {
  return typeof value === 'string' && value in WIZARD_THEMES
}

export function isWizardVoice(value: unknown): value is string {
  return WIZARD_VOICES.some((voice) => voice.id === value)
}

export function spokenText(step: Pick<VoiceWizardStep, 'narration' | 'heading' | 'body'>): string {
  return step.narration.trim() || [step.heading, step.body].filter(Boolean).join('. ')
}

export function newStepId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function emptyStep(): VoiceWizardStep {
  return { id: newStepId(), heading: '', body: '', narration: '', ctaLabel: '', ctaUrl: '', target: '' }
}

/** Only http(s) or same-site relative links — blocks `javascript:` and other schemes. */
export function sanitizeCtaUrl(value: string): string {
  const trimmed = value.trim().slice(0, WIZARD_LIMITS.ctaUrl)
  if (!trimmed) return ''
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed
  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : ''
  } catch {
    return ''
  }
}

function clampText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/** Normalizes untrusted step JSON (client input, DB, or LLM output). Preserves Bangla Unicode. */
export function sanitizeSteps(raw: unknown): VoiceWizardStep[] {
  if (!Array.isArray(raw)) return []
  const seenIds = new Set<string>()
  const steps: VoiceWizardStep[] = []
  for (const item of raw.slice(0, WIZARD_LIMITS.maxSteps)) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    let id = clampText(record.id, 32).replace(/[^a-zA-Z0-9_-]/g, '')
    if (!id || seenIds.has(id)) id = newStepId()
    seenIds.add(id)
    const step: VoiceWizardStep = {
      id,
      heading: clampText(record.heading, WIZARD_LIMITS.heading),
      body: clampText(record.body, WIZARD_LIMITS.body),
      narration: clampText(record.narration, WIZARD_LIMITS.narration),
      ctaLabel: clampText(record.ctaLabel, WIZARD_LIMITS.ctaLabel),
      ctaUrl: sanitizeCtaUrl(typeof record.ctaUrl === 'string' ? record.ctaUrl : ''),
      target: clampText(record.target, WIZARD_LIMITS.target)
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    }
    if (!step.heading && !step.body && !step.narration) continue
    steps.push(step)
  }
  return steps
}

/** Data the public tour player needs (serializable). */
export type PublicWizardStep = VoiceWizardStep & {
  /** Content hash for cache-busting the audio URL; null when the browser voice is used. */
  audioVersion: string | null
}

export type PublicWizard = {
  slug: string
  name: string
  guideName: string
  businessName: string
  language: WizardLanguage
  theme: WizardThemeId
  shape: WizardShape
  steps: PublicWizardStep[]
  chatUrl: string | null
  isPublished: boolean
}
