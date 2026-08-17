import type { OutreachChannel } from '@prisma/client'

export const INDUSTRY_VERTICALS = [
  'insurance',
  'tax',
  'ecommerce',
  'real_estate',
  'agency',
  'technology',
  'fashion',
  'wholesale',
  'healthcare',
  'education',
] as const

export type IndustryVertical = (typeof INDUSTRY_VERTICALS)[number]

type CoreInput = {
  termsAndConditions?: string
}

export type IndustryInput = {
  summary?: string
  coverageTypes?: string[]
  exclusions?: string[]
  disclaimers?: string[]
  filingTypes?: string[]
  jurisdiction?: string
  deadlines?: string[]
  catalog?: string[]
  shippingPolicy?: string
  returnPolicy?: string
  areas?: string[]
  budgetBands?: string[]
  propertyTypes?: string[]
  servicePackages?: string[]
  deliverables?: string[]
  sla?: string
  typeSort?: Array<{
    type?: string
    category?: string
    title?: string
    description?: string
    detailsShort?: string
    detailsLong?: string
    price?: string
    sortOrder?: number
    isActive?: boolean
  }>
}

type IndustryInputRaw = IndustryInput & {
  serviceCatalog?: IndustryInput['typeSort']
}

/** One canonical services list per tenant — merges legacy serviceCatalog into typeSort. */
export const normalizeIndustryInput = (industry: IndustryInputRaw | null | undefined): IndustryInput => {
  if (!industry || typeof industry !== 'object') return {}

  const { serviceCatalog, typeSort, ...rest } = industry
  const merged = (typeSort?.length ? typeSort : serviceCatalog) || []

  return {
    ...rest,
    typeSort: merged.map((item, index) => ({
      type: item?.type || 'insurance',
      category: item?.category || '',
      title: item?.title || '',
      description: item?.description || '',
      detailsShort: item?.detailsShort || '',
      detailsLong: item?.detailsLong || '',
      price: item?.price || '',
      sortOrder: item?.sortOrder ?? index + 1,
      isActive: item?.isActive ?? true,
    })),
  }
}

type SocialInput = {
  socials?: Array<{ platform: string; handle?: string; url?: string }>
  websiteUrl?: string
}

export type TenantContextDraft = {
  vertical?: string
  core: CoreInput
  industry: IndustryInput
  social: SocialInput
  blog?: { intro?: string }
}

const nonEmpty = (value?: string | null) => (value || '').trim()

export const buildCompactProfile = (
  tenantName: string,
  businessName: string | null,
  draft: TenantContextDraft,
  channels: Pick<OutreachChannel, 'platform' | 'accountLabel' | 'pageUrl'>[] = [],
) => {
  const compact = {
    tenantName,
    businessName: businessName || tenantName,
    vertical: nonEmpty(draft.vertical),
    core: {
      termsAndConditions: nonEmpty(draft.core.termsAndConditions),
    },
    industry: normalizeIndustryInput(draft.industry),
    social: {
      ...draft.social,
      channels: channels.map((channel) => ({
        platform: channel.platform,
        label: channel.accountLabel || undefined,
        url: channel.pageUrl || undefined,
      })),
    },
    blog: {
      intro: nonEmpty(draft.blog?.intro),
    },
  }

  const compactString = JSON.stringify(compact)
  const compactTokenEstimate = Math.ceil(compactString.length / 4)

  return { compact, compactTokenEstimate }
}

export const buildContextVersion = () => `ctx_${Date.now()}`

