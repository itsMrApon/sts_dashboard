/**
 * Website content a creator manages on the Business page (client + server safe).
 * Stored under Workspace.contextCoreJson.site; services/socials are mirrored into the legacy
 * industry/social JSON so the AI context and public profile API keep working.
 */

import { ACCENTS, type AccentId } from '@/lib/services/types'

export type SiteSeo = { title: string; description: string; ogImage: string }

/** The Contact: how visitors reach the business, plus the footer's tagline and legal links. */
export type SiteFooter = {
  email: string
  phone: string
  address: string
  /** Free text, e.g. "Mon–Fri 9am–6pm, Sat 10am–2pm". */
  hours: string
  mapUrl: string
  /** Trust badges, e.g. "Licensed in NY", "10 years in business". */
  credentials: string[]
  tagline: string
  copyright: string
  privacyUrl: string
  termsUrl: string
}

export type SocialAccount = { id: string; platform: string; handle: string; url: string }
export type SocialMedia = { id: string; type: 'image' | 'video'; url: string; caption: string }
export type SiteSocial = { followLabel: string; accounts: SocialAccount[]; media: SocialMedia[] }

/**
 * A document customers need (Docs): a form, a checklist item, a PDF. It stands on its own;
 * serviceIds optionally ties it to Menu services ("Used for"), so a site can show it under them.
 */
export type SiteDoc = { id: string; name: string; formCode: string; issuer: string; pdfUrl: string; serviceIds: string[] }
export type SiteService = {
  id: string
  name: string
  category: string
  summary: string
  price: string
  active: boolean
}

/** Live: how upcoming webinars show on the website. Sessions themselves are scheduled in Projects. */
export type SiteLive = {
  enabled: boolean
  /** Heading above the sessions, e.g. "Join us live". */
  title: string
  joinLabel: string
  maxSessions: number
  /** Webinars (by slug) kept off the website. */
  hiddenSlugs: string[]
}

export const LIVE_MAX_OPTIONS = [1, 3, 5, 10] as const

export type KeyDate = {
  id: string
  /** YYYY-MM-DD */
  date: string
  title: string
  serviceId: string
  perk: string
  gift: string
  govFee: string
  note: string
}

/**
 * vertical = business type, location = where it operates (city / region). Both set at onboarding.
 * lookupTags = what the creator typed to find the business online (@handles, domains, names); the
 * scrape agent researches them later, once the creator has an AI key.
 */
export type SiteAdvanced = { vertical: string; location: string; lookupTags: string[]; websiteUrl: string; termsAndConditions: string }

/** Look of the hosted business site (/business/<room>): colour, hero, which blocks show. */
export type SiteAppearance = {
  accent: AccentId
  heroAlign: 'center' | 'left'
  show: { offers: boolean; services: boolean; keyDates: boolean; social: boolean; terms: boolean }
  /** Hero buttons (each also needs its service switched on). */
  actions: { chat: boolean; speak: boolean; form: boolean; wizard: boolean }
}

export const SITE_BLOCKS: { id: keyof SiteAppearance['show']; label: string }[] = [
  { id: 'offers', label: 'Offers' },
  { id: 'services', label: 'Services' },
  { id: 'keyDates', label: 'Key dates' },
  { id: 'social', label: 'Social & media' },
  { id: 'terms', label: 'Terms' },
]

export const SITE_ACTIONS: { id: keyof SiteAppearance['actions']; label: string }[] = [
  { id: 'chat', label: 'Chat with us' },
  { id: 'speak', label: 'Call us' },
  { id: 'form', label: 'Request a callback' },
  { id: 'wizard', label: 'Take the tour' },
]

export type BusinessSiteContent = {
  seo: SiteSeo
  footer: SiteFooter
  social: SiteSocial
  services: SiteService[]
  docs: SiteDoc[]
  live: SiteLive
  keyDates: KeyDate[]
  advanced: SiteAdvanced
  appearance: SiteAppearance
}

export type SiteSection = 'look' | 'seo' | 'footer' | 'social' | 'services' | 'docs' | 'live' | 'keyDates' | 'advanced'

const SITE_SECTION_IDS: readonly SiteSection[] = ['look', 'seo', 'footer', 'social', 'services', 'docs', 'live', 'keyDates', 'advanced']

export function isSiteSection(value: unknown): value is SiteSection {
  return SITE_SECTION_IDS.includes(value as SiteSection)
}

export const SITE_LIMITS = {
  seoTitle: 70,
  seoDescription: 160,
  url: 500,
  short: 120,
  text: 600,
  terms: 20_000,
  accounts: 20,
  media: 24,
  services: 40,
  docs: 60,
  keyDates: 150,
  lookupTags: 12,
  credentials: 6,
} as const

export const SOCIAL_PLATFORMS: { id: string; label: string; urlFor: (handle: string) => string }[] = [
  { id: 'facebook', label: 'Facebook', urlFor: (h) => `https://facebook.com/${h}` },
  { id: 'instagram', label: 'Instagram', urlFor: (h) => `https://instagram.com/${h}` },
  { id: 'youtube', label: 'YouTube', urlFor: (h) => `https://youtube.com/@${h}` },
  { id: 'tiktok', label: 'TikTok', urlFor: (h) => `https://tiktok.com/@${h}` },
  { id: 'linkedin', label: 'LinkedIn', urlFor: (h) => `https://linkedin.com/company/${h}` },
  { id: 'x', label: 'X (Twitter)', urlFor: (h) => `https://x.com/${h}` },
  { id: 'whatsapp', label: 'WhatsApp', urlFor: (h) => `https://wa.me/${h.replace(/[^\d]/g, '')}` },
  { id: 'telegram', label: 'Telegram', urlFor: (h) => `https://t.me/${h}` },
]

export const VERTICALS: { id: string; label: string }[] = [
  { id: 'insurance', label: 'Insurance' },
  { id: 'tax', label: 'Tax & advisory' },
  { id: 'ecommerce', label: 'Commerce' },
  { id: 'real_estate', label: 'Property' },
  { id: 'agency', label: 'Agency' },
  { id: 'technology', label: 'Technology' },
  { id: 'fashion', label: 'Fashion' },
  { id: 'wholesale', label: 'Wholesale' },
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'education', label: 'Education' },
  { id: 'food', label: 'Food & drink' },
  { id: 'beauty', label: 'Beauty & wellness' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'legal', label: 'Legal' },
  { id: 'home_services', label: 'Home services' },
  { id: 'travel', label: 'Travel' },
  { id: 'other', label: 'Something else' },
]

export function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function socialUrl(platform: string, handle: string): string {
  const clean = handle.trim().replace(/^@/, '')
  if (!clean) return ''
  return SOCIAL_PLATFORMS.find((item) => item.id === platform)?.urlFor(clean) ?? ''
}

export function defaultCopyright(businessName: string): string {
  return `© ${new Date().getFullYear()} ${businessName}. All rights reserved.`
}

export function emptySiteContent(businessName: string): BusinessSiteContent {
  return {
    seo: { title: businessName, description: '', ogImage: '' },
    footer: {
      email: '',
      phone: '',
      address: '',
      hours: '',
      mapUrl: '',
      credentials: [],
      tagline: '',
      copyright: defaultCopyright(businessName),
      privacyUrl: '',
      termsUrl: '',
    },
    social: { followLabel: 'Follow on', accounts: [], media: [] },
    services: [],
    docs: [],
    live: { enabled: true, title: 'Join us live', joinLabel: 'Join', maxSessions: 5, hiddenSlugs: [] },
    keyDates: [],
    advanced: { vertical: '', location: '', lookupTags: [], websiteUrl: '', termsAndConditions: '' },
    appearance: {
      accent: 'violet',
      heroAlign: 'center',
      show: { offers: true, services: true, keyDates: true, social: true, terms: true },
      actions: { chat: true, speak: true, form: true, wizard: true },
    },
  }
}

// ── sanitizers (preserve Bangla Unicode: trim + clamp only) ──────────────────

type Rec = Record<string, unknown>
const rec = (value: unknown): Rec => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Rec) : {})
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
const str = (value: unknown, max: number = SITE_LIMITS.short): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : typeof value === 'number' ? String(value) : ''

/** Only http(s) or site-relative links — blocks javascript: and other schemes. */
export function safeUrl(value: unknown): string {
  const raw = str(value, SITE_LIMITS.url)
  if (!raw) return ''
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw
  if (raw.startsWith('mailto:')) return raw
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : ''
  } catch {
    return ''
  }
}

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
const idOf = (value: unknown, seen: Set<string>) => {
  let id = str(value, 32).replace(/[^a-zA-Z0-9_-]/g, '')
  if (!id || seen.has(id)) id = newId()
  seen.add(id)
  return id
}

export function sanitizeSiteContent(raw: unknown, businessName: string): BusinessSiteContent {
  const input = rec(raw)
  const base = emptySiteContent(businessName)
  const seo = rec(input.seo)
  const footer = rec(input.footer)
  const social = rec(input.social)
  const advanced = rec(input.advanced)
  const live = rec(input.live)
  const appearance = rec(input.appearance)
  const ids = new Set<string>()
  const flags = <K extends string>(value: unknown, defaults: Record<K, boolean>): Record<K, boolean> => {
    const row = rec(value)
    return Object.fromEntries(
      Object.entries(defaults).map(([key, fallback]) => [key, typeof row[key] === 'boolean' ? row[key] : fallback]),
    ) as Record<K, boolean>
  }

  // Older content kept documents inside each service; they move to the Docs list, tied to that service.
  const legacyDocs: unknown[] = []
  const services: SiteService[] = arr(input.services)
    .slice(0, SITE_LIMITS.services)
    .map((item) => {
      const row = rec(item)
      const id = idOf(row.id, ids)
      for (const doc of arr(row.docs)) legacyDocs.push({ ...rec(doc), serviceIds: [id] })
      return {
        id,
        name: str(row.name),
        category: str(row.category),
        summary: str(row.summary, SITE_LIMITS.text),
        price: str(row.price, 60),
        active: row.active !== false,
      }
    })
    .filter((service) => service.name)

  const serviceIds = new Set(services.map((service) => service.id))
  const docs: SiteDoc[] = (Array.isArray(input.docs) ? input.docs : legacyDocs)
    .slice(0, SITE_LIMITS.docs)
    .map((item) => {
      const row = rec(item)
      return {
        id: idOf(row.id, ids),
        name: str(row.name),
        formCode: str(row.formCode, 60),
        issuer: str(row.issuer),
        pdfUrl: safeUrl(row.pdfUrl),
        serviceIds: [...new Set(arr(row.serviceIds).map((value) => str(value, 32)))].filter((value) => serviceIds.has(value)),
      }
    })
    .filter((doc) => doc.name || doc.formCode)
  const keyDates: KeyDate[] = arr(input.keyDates)
    .slice(0, SITE_LIMITS.keyDates)
    .map((item) => {
      const row = rec(item)
      const serviceId = str(row.serviceId, 32)
      return {
        id: idOf(row.id, ids),
        date: isDate(str(row.date, 10)) ? str(row.date, 10) : '',
        title: str(row.title),
        serviceId: serviceIds.has(serviceId) ? serviceId : '',
        perk: str(row.perk),
        gift: str(row.gift),
        govFee: str(row.govFee, 60),
        note: str(row.note, SITE_LIMITS.text),
      }
    })
    .filter((row) => row.title || row.date)
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))

  const email = str(footer.email, 200)
  return {
    seo: {
      title: str(seo.title, SITE_LIMITS.seoTitle) || base.seo.title,
      description: str(seo.description, SITE_LIMITS.seoDescription),
      ogImage: safeUrl(seo.ogImage),
    },
    footer: {
      email: isEmail(email) ? email : '',
      phone: str(footer.phone, 40),
      address: str(footer.address, 200),
      hours: str(footer.hours, 200),
      mapUrl: safeUrl(footer.mapUrl),
      credentials: [...new Set(arr(footer.credentials).map((item) => str(item, 80)).filter(Boolean))].slice(0, SITE_LIMITS.credentials),
      tagline: str(footer.tagline, 200),
      copyright: 'copyright' in footer ? str(footer.copyright, 200) : base.footer.copyright,
      privacyUrl: safeUrl(footer.privacyUrl),
      termsUrl: safeUrl(footer.termsUrl),
    },
    social: {
      followLabel: str(social.followLabel, 40) || base.social.followLabel,
      accounts: arr(social.accounts)
        .slice(0, SITE_LIMITS.accounts)
        .map((item) => {
          const row = rec(item)
          const platform = SOCIAL_PLATFORMS.some((p) => p.id === row.platform) ? String(row.platform) : 'facebook'
          const handle = str(row.handle).replace(/^@/, '')
          return { id: idOf(row.id, ids), platform, handle, url: safeUrl(row.url) || socialUrl(platform, handle) }
        })
        .filter((row) => row.handle || row.url),
      media: arr(social.media)
        .slice(0, SITE_LIMITS.media)
        .map((item) => {
          const row = rec(item)
          return {
            id: idOf(row.id, ids),
            type: row.type === 'video' ? ('video' as const) : ('image' as const),
            url: safeUrl(row.url),
            caption: str(row.caption, 200),
          }
        })
        .filter((row) => row.url),
    },
    services,
    docs,
    live: {
      enabled: typeof live.enabled === 'boolean' ? live.enabled : base.live.enabled,
      title: str(live.title, 80) || base.live.title,
      joinLabel: str(live.joinLabel, 30) || base.live.joinLabel,
      maxSessions: LIVE_MAX_OPTIONS.includes(Number(live.maxSessions) as (typeof LIVE_MAX_OPTIONS)[number])
        ? Number(live.maxSessions)
        : base.live.maxSessions,
      hiddenSlugs: [...new Set(arr(live.hiddenSlugs).map((slug) => str(slug, 80)).filter(Boolean))].slice(0, 100),
    },
    keyDates,
    advanced: {
      vertical: VERTICALS.some((v) => v.id === advanced.vertical) ? String(advanced.vertical) : '',
      location: str(advanced.location, SITE_LIMITS.short),
      lookupTags: [...new Set(arr(advanced.lookupTags).map((tag) => str(tag, 80)).filter(Boolean))].slice(0, SITE_LIMITS.lookupTags),
      websiteUrl: safeUrl(advanced.websiteUrl),
      termsAndConditions: str(advanced.termsAndConditions, SITE_LIMITS.terms),
    },
    appearance: {
      accent: ACCENTS.some((accent) => accent.id === appearance.accent) ? (appearance.accent as AccentId) : base.appearance.accent,
      heroAlign: appearance.heroAlign === 'left' ? 'left' : 'center',
      show: flags(appearance.show, base.appearance.show),
      actions: flags(appearance.actions, base.appearance.actions),
    },
  }
}

/** First open: build site content from the older Publish data (services, socials, terms). */
export function siteContentFromLegacy(input: {
  businessName: string
  vertical: string | null
  core: unknown
  industry: unknown
  social: unknown
}): BusinessSiteContent {
  const core = rec(input.core)
  if (core.site) return sanitizeSiteContent(core.site, input.businessName)

  const industry = rec(input.industry)
  const social = rec(input.social)
  const legacyServices = arr(industry.typeSort).length ? arr(industry.typeSort) : arr(industry.serviceCatalog)
  return sanitizeSiteContent(
    {
      services: legacyServices.map((item) => {
        const row = rec(item)
        return {
          name: row.title,
          category: row.category,
          summary: row.description || row.detailsShort,
          price: row.price,
          active: row.isActive !== false,
        }
      }),
      social: {
        accounts: arr(social.socials).map((item) => {
          const row = rec(item)
          return { platform: String(row.platform || '').toLowerCase(), handle: row.handle, url: row.url }
        }),
      },
      advanced: {
        vertical: input.vertical,
        websiteUrl: social.websiteUrl,
        termsAndConditions: core.termsAndConditions,
      },
    },
    input.businessName,
  )
}
