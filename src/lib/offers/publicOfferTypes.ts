import type { AiService, OfferKindInput, OrderModesInput } from './offerTypes'

/** Client-safe shape of an offer as buyers see it on /o/[slug] and /pay/[slug]. */
export type BuyerPriceOption = {
  id: string
  kind: 'ONE_TIME' | 'MONTHLY' | 'DEPOSIT'
  /** Null for a legacy Stripe price whose amount was never synced. */
  amountCents: number | null
  depositCents: number | null
  balanceDueDays: number | null
  isDefault: boolean
}

export type PublicOfferView = {
  id: string
  slug: string
  title: string
  description: string
  kind: OfferKindInput
  thumbnail: string | null
  startTime: string
  webinarStatus: string
  business: { name: string; logo: string | null }
  /** False when the creator has no package or no Stripe connection: show the page, block paying. */
  acceptingPayments: boolean
  /** False when the creator has no package: the whole offer is unavailable. */
  live: boolean
  prices: BuyerPriceOption[]
  modes: OrderModesInput
  aiServices: AiService[]
  /** The creator's voice tour (Guided tour option): published, or a draft only its owner can load. */
  wizardSlug: string | null
}

export type OfferChatMessage = {
  role: 'user' | 'assistant'
  content: string
  /** Set when the creator typed it from the pipeline (not the AI). */
  from?: 'creator'
}

export type BuyerContactView = { name: string | null; email: string | null; phone: string | null }

export function describePrice(option: BuyerPriceOption): { title: string; detail: string | null } {
  const usd = (cents: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: cents % 100 ? 2 : 0,
    }).format(cents / 100)

  if (option.amountCents == null) return { title: 'Buy now', detail: null }
  if (option.kind === 'MONTHLY') return { title: `${usd(option.amountCents)} / month`, detail: 'Cancel anytime' }
  if (option.kind === 'DEPOSIT' && option.depositCents != null) {
    const rest = option.amountCents - option.depositCents
    return {
      title: `${usd(option.depositCents)} today`,
      detail: `then ${usd(rest)} in ${option.balanceDueDays ?? 14} days · ${usd(option.amountCents)} total`,
    }
  }
  return { title: `${usd(option.amountCents)}`, detail: 'Pay in full' }
}
