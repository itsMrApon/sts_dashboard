/**
 * Client-safe display helpers for an offer's price and webinar status (Projects cards, AI context).
 */

export type OfferPriceSummary = {
  amountCents: number
  currency: string
  kind: 'ONE_TIME' | 'MONTHLY'
}

export type WebinarStatus = 'SCHEDULED' | 'WAITING_ROOM' | 'LIVE' | 'ENDED' | 'CANCELLED'

export function formatOfferPrice(price: OfferPriceSummary): string {
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: price.currency.toUpperCase(),
    maximumFractionDigits: price.amountCents % 100 ? 2 : 0,
  }).format(price.amountCents / 100)
  return price.kind === 'MONTHLY' ? `${amount}/month` : `${amount} one-time`
}

export const WEBINAR_STATUS_LABEL: Record<WebinarStatus, string> = {
  SCHEDULED: 'Scheduled',
  WAITING_ROOM: 'Waiting room',
  LIVE: 'Live now',
  ENDED: 'Ended',
  CANCELLED: 'Cancelled',
}

/** Ended or cancelled webinars are history: not promoted by the AI or on the business page. */
export function isWebinarOver(status: WebinarStatus): boolean {
  return status === 'ENDED' || status === 'CANCELLED'
}

/** The buyer-facing default (what "Buy now" charges today): the default active non-deposit price. */
export function pickDefaultPrice<T extends { kind: string; active: boolean; isDefault: boolean }>(prices: T[]): T | null {
  const active = prices.filter((price) => price.active && price.kind !== 'DEPOSIT')
  return active.find((price) => price.isDefault) ?? active[0] ?? null
}

/** The default price as a display summary; null when there is none or its amount isn't known yet. */
export function summarizeOfferPrice(
  prices: { kind: string; active: boolean; isDefault: boolean; amountCents: number | null; currency: string }[],
): OfferPriceSummary | null {
  const price = pickDefaultPrice(prices)
  if (!price || price.amountCents == null) return null
  return { amountCents: price.amountCents, currency: price.currency, kind: price.kind === 'MONTHLY' ? 'MONTHLY' : 'ONE_TIME' }
}
