/**
 * Client-safe types and constants for offer settings (no Prisma runtime import, so client
 * components can use them).
 */
export const ORDER_MODE_KINDS = ['INSTANT_CHECKOUT', 'AI_ASSISTANT', 'LIVE_HOST', 'DIRECT_PAY'] as const
export type OrderModeKey = (typeof ORDER_MODE_KINDS)[number]
export type OrderModesInput = Record<OrderModeKey, boolean>

export const AI_SERVICES = ['CHAT', 'SPEAK', 'WIZARD'] as const
export type AiService = (typeof AI_SERVICES)[number]

export type OfferKindInput = 'PRODUCT' | 'WEBINAR'

export const PRICE_LIMITS = {
  /** Stripe's minimum charge in USD. */
  minCents: 50,
  maxCents: 99_999_900,
  maxBalanceDays: 90,
} as const

export type OfferPricingInput = {
  currency: 'usd'
  billing: 'ONE_TIME' | 'MONTHLY'
  amountCents: number
  deposit: { enabled: boolean; depositCents: number; balanceDueDays: number }
  monthlyOption: { enabled: boolean; amountCents: number }
}

export type OfferSettingsView = {
  id: string
  title: string
  description: string
  kind: OfferKindInput
  /** ISO string */
  startTime: string
  slug: string | null
  pricing: OfferPricingInput & { legacyPriceUnsynced: boolean }
  modes: OrderModesInput
  aiServices: AiService[]
  livekitAgentId: string | null
  agents: { id: string; name: string }[]
  hasBusiness: boolean
  onBusiness: boolean
  stripeConnected: boolean
  hasPaidAccess: boolean
  shareLinks: { variant: string; label: string; url: string }[]
  /** The per-variant links from before /o existed; they keep working. */
  legacyLinks: { variant: string; label: string; url: string }[]
  orders: OfferOrderRow[]
  orderSummary: { collectedCents: number; paidCount: number; balanceDueCents: number }
}

export type OfferOrderRow = {
  id: string
  status: 'PENDING' | 'DEPOSIT_PAID' | 'PAID' | 'REFUNDED' | 'FAILED' | 'CANCELED'
  way: OrderModeKey | null
  priceKind: 'ONE_TIME' | 'MONTHLY' | 'DEPOSIT' | null
  source: string | null
  currency: string
  amountTotalCents: number
  amountPaidCents: number
  /** ISO string */
  createdAt: string
  buyer: string | null
}

export const ORDER_MODE_COPY: Record<OrderModeKey, { title: string; description: string }> = {
  INSTANT_CHECKOUT: {
    title: 'Instant checkout',
    description: 'Buyer leaves their email or WhatsApp, picks a price, then pays on Stripe.',
  },
  AI_ASSISTANT: {
    title: 'AI sales assistant',
    description: 'Buyer talks to your AI by chat, voice or wizard; the AI brings up the order button.',
  },
  LIVE_HOST: {
    title: 'Live with you',
    description: 'During your live webinar you drop the offer and attendees get an order button.',
  },
  DIRECT_PAY: {
    title: 'Direct pay link',
    description: 'Straight to Stripe with no form. For your website or a quick payment link.',
  },
}
