export type StsOptions = {
  /** Your STS-AI app URL, e.g. https://app.sts-ai.com */
  apiBase: string
  /** Publishable site key (sts_pk_live_…). Safe in the browser; only works on your allowed website. */
  siteKey: string
}

export type FormFieldType = 'text' | 'email' | 'phone' | 'textarea' | 'select'

/** Brand colour picked in the dashboard, as a hex string (e.g. "#8b5cf6"). */
export type StsAccent = string

export type StsFormField = {
  id: string
  label: string
  type: FormFieldType
  required: boolean
  options: string[]
  placeholder: string
  helpText: string
}

export type StsForm = {
  title: string
  description: string
  fields: StsFormField[]
  consentText: string
  submitLabel: string
  successMessage: string
  accent: StsAccent
  layout: 'single' | 'double'
  /** Send the visitor here after a successful submit, when set. */
  redirectUrl: string | null
}

export type StsChatConfig = {
  greeting: string
  suggestions: string[]
  maxMessageLength: number
  includeLinks: boolean
  /** Name for your chat header. */
  assistantName: string
  inputPlaceholder: string
  /** Show this when a reply fails. */
  fallbackMessage: string
  showHumanHandoff: boolean
  accent: StsAccent
}

export type StsSpeakConfig = {
  maxCallMinutes: number
  firstMessage: string | null
  language: 'en' | 'bn'
  callButtonLabel: string
  /** Warn the caller this many seconds before the limit (0 = no warning). */
  endWarningSeconds: number
  showHumanHandoff: boolean
}

export type StsSessionInfo = {
  business: { name: string; description: string | null; aiName: string | null }
  /** `null` = that service is turned off in the STS-AI dashboard. */
  services: {
    chat: StsChatConfig | null
    speak: StsSpeakConfig | null
    form: StsForm | null
    wizards: { slug: string; name: string; language: string }[]
  }
}

export type StsChatLinks = {
  products: { name: string; url: string; buyUrl?: string }[]
  buyNow: string | null
  social: { platform: string; label: string; url?: string }[]
} | null

export type StsChatReply = { reply: string; links: StsChatLinks }

export type StsSpeakConnection = {
  serverUrl: string
  roomName: string
  participantName: string
  participantToken: string
  maxCallMinutes: number
}

export type StsWizardStep = {
  id: string
  heading: string
  body: string
  narration: string
  /** `data-sts-step` value of the section on your page, if set. */
  target: string | null
  ctaLabel: string | null
  ctaUrl: string | null
  audioUrl: string | null
}

export type StsWizard = {
  slug: string
  name: string
  guideName: string
  language: 'en' | 'bn'
  steps: StsWizardStep[]
}

export type StsBusinessService = { id: string; name: string; category: string; summary: string; price: string }

export type StsBusinessSite = {
  seo: { title: string; description: string; ogImage: string }
  services: StsBusinessService[]
  keyDates: { id: string; date: string; title: string }[]
  social: { followLabel: string; accounts: { id: string; platform: string; handle: string; url: string }[] }
  footer: { email: string; tagline: string; copyright: string; privacyUrl: string; termsUrl: string }
  appearance: {
    accent: StsAccent
    heroAlign: 'center' | 'left'
    show: { offers: boolean; services: boolean; keyDates: boolean; social: boolean; terms: boolean }
    actions: { chat: boolean; speak: boolean; form: boolean; wizard: boolean }
  }
}

export type StsBusiness = {
  name: string
  description: string | null
  profile: Record<string, unknown> | null
  publishedAt: string | null
  /** Published content from Messages → Business; null until the business is published. */
  site: StsBusinessSite | null
}

export class StsError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly fieldId: string | null = null,
  ) {
    super(message)
    this.name = 'StsError'
  }
}
