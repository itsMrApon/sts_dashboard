import type { OrderModeKey, OrderModesInput } from './offerTypes'

/**
 * The public links of an offer, one per experience (client-safe, no Prisma):
 *   share → /o/[slug]    lead, then the AI room (chat · guided tour · voice) or a plain checkout
 *   pay   → /pay/[slug]  straight to Stripe, no form
 *   live  → /live/[slug] waiting room with a countdown, then the live session with a Buy now button
 */
export type OfferShareLink = {
  variant: 'share' | 'pay' | 'live'
  label: string
  hint: string
  url: string
}

export function buildOfferShareLinks(
  slug: string | null,
  modes: Partial<Record<OrderModeKey, boolean>> | OrderModesInput,
  baseUrl: string,
): OfferShareLink[] {
  if (!slug) return []
  const base = baseUrl.replace(/\/+$/, '')
  const links: OfferShareLink[] = []
  if (modes.AI_ASSISTANT || modes.INSTANT_CHECKOUT) {
    links.push({
      variant: 'share',
      label: 'Share link',
      hint: modes.AI_ASSISTANT
        ? 'Chat, guided tour and voice with your AI, then checkout'
        : 'Email or WhatsApp, then checkout',
      url: `${base}/o/${slug}`,
    })
  }
  if (modes.DIRECT_PAY) {
    links.push({ variant: 'pay', label: 'Direct pay link', hint: 'Straight to Stripe, no form', url: `${base}/pay/${slug}` })
  }
  if (modes.LIVE_HOST) {
    links.push({
      variant: 'live',
      label: 'Live link',
      hint: 'Waiting room with a countdown, then your live session',
      url: `${base}/live/${slug}`,
    })
  }
  return links
}
