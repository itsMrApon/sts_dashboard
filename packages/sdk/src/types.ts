export type StsOptions = {
  /** Your STS-AI app URL, e.g. https://app.sts-ai.com */
  apiBase: string
  /** Publishable site key (sts_pk_live_…). Safe in the browser; only works on your allowed website. */
  siteKey: string
}

export type FormFieldType = 'text' | 'email' | 'phone' | 'textarea' | 'select'

export type StsFormField = {
  id: string
  label: string
  type: FormFieldType
  required: boolean
  options: string[]
}

export type StsForm = {
  title: string
  description: string
  fields: StsFormField[]
  consentText: string
  submitLabel: string
}

export type StsChatConfig = {
  greeting: string
  suggestions: string[]
  maxMessageLength: number
  includeLinks: boolean
}

export type StsSpeakConfig = {
  maxCallMinutes: number
  firstMessage: string | null
  language: 'en' | 'bn'
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

export type StsBusiness = {
  name: string
  description: string | null
  profile: Record<string, unknown> | null
  publishedAt: string | null
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
