export const WEBINAR_LINK_VARIANTS = [
  'PROJECT_BOOK_A_CALL',
  'PROJECT_BUY_NOW',
  'PRODUCT_BOOK_A_CALL',
  'PRODUCT_BUY_NOW',
] as const

export type WebinarLinkVariant = (typeof WEBINAR_LINK_VARIANTS)[number]

export const DEFAULT_VARIANT: WebinarLinkVariant = 'PROJECT_BOOK_A_CALL'

export const VARIANT_META: Record<
  WebinarLinkVariant,
  {
    label: string
    kind: 'project' | 'product'
    ctaType: 'BOOK_A_CALL' | 'BUY_NOW'
  }
> = {
  PROJECT_BOOK_A_CALL: {
    label: 'Webinar - Book a Call',
    kind: 'project',
    ctaType: 'BOOK_A_CALL',
  },
  PROJECT_BUY_NOW: {
    label: 'Webinar - Order Now',
    kind: 'project',
    ctaType: 'BUY_NOW',
  },
  PRODUCT_BOOK_A_CALL: {
    label: 'Product - Book a Call',
    kind: 'product',
    ctaType: 'BOOK_A_CALL',
  },
  PRODUCT_BUY_NOW: {
    label: 'Product - Order Now',
    kind: 'product',
    ctaType: 'BUY_NOW',
  },
}

export const isWebinarLinkVariant = (value: string): value is WebinarLinkVariant => {
  return WEBINAR_LINK_VARIANTS.includes(value as WebinarLinkVariant)
}

export const sanitizeVariants = (variants?: string[]): WebinarLinkVariant[] => {
  if (!variants?.length) return [DEFAULT_VARIANT]

  const unique = Array.from(new Set(variants.filter(isWebinarLinkVariant)))
  return unique.length ? unique : [DEFAULT_VARIANT]
}

export const hasProjectVariant = (variants: WebinarLinkVariant[]) =>
  variants.some((variant) => VARIANT_META[variant].kind === 'project')

export const hasBookCallVariant = (variants: WebinarLinkVariant[]) =>
  variants.some((variant) => VARIANT_META[variant].ctaType === 'BOOK_A_CALL')

export const hasBuyNowVariant = (variants: WebinarLinkVariant[]) =>
  variants.some((variant) => VARIANT_META[variant].ctaType === 'BUY_NOW')

export const buildVariantPath = (id: string, variant: WebinarLinkVariant) => {
  const meta = VARIANT_META[variant]
  const base = meta.kind === 'product' ? `/live-product/${id}` : `/live-project/${id}`
  return `${base}?variant=${variant}`
}

export const buildVariantLinks = (id: string, variants: WebinarLinkVariant[], baseUrl = '') => {
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  return variants.map((variant) => ({
    variant,
    label: VARIANT_META[variant].label,
    url: `${normalizedBaseUrl}${buildVariantPath(id, variant)}`,
  }))
}

export const resolveVariantFromParam = (variantParam?: string | null) => {
  if (!variantParam || !isWebinarLinkVariant(variantParam)) return null
  return variantParam
}

