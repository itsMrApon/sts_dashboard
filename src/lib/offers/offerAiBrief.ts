import 'server-only'
import { describePrice, type BuyerPriceOption } from './publicOfferTypes'

/**
 * Extra instructions that turn the business AI into a sales assistant for one offer.
 * Shared by chat (marker in the reply) and voice (a tool call). The AI never quotes a price
 * that is not listed here and never collects card details itself: payment is always Stripe.
 */

/** Chat replies end with this token when the buyer is ready; the server strips it. */
export const CHAT_ORDER_MARKER = '[[SHOW_ORDER]]'

export type OfferBriefInput = {
  title: string
  description: string
  businessName: string
  prices: BuyerPriceOption[]
}

function priceLines(prices: BuyerPriceOption[]): string {
  if (!prices.length) return '- Price: ask the team (not listed online)'
  return prices
    .map((price) => {
      const text = describePrice(price)
      return `- ${text.title}${text.detail ? ` (${text.detail})` : ''}`
    })
    .join('\n')
}

export function buildOfferBrief(offer: OfferBriefInput, channel: 'chat' | 'voice'): string {
  const orderRule =
    channel === 'chat'
      ? `When the buyer clearly wants to buy or asks how to pay, tell them you are bringing up the order button and end your reply with ${CHAT_ORDER_MARKER} exactly once. Do not use that token otherwise.`
      : 'When the buyer clearly wants to buy or asks how to pay, call the show_order_button tool once, then tell them the order button is now on their screen.'

  return [
    `You are now helping a buyer who opened ${offer.businessName}'s offer page for: "${offer.title}".`,
    offer.description ? `About the offer: ${offer.description}` : null,
    'Payment options (these are the only prices; never invent or change them):',
    priceLines(offer.prices),
    'Your goal: answer questions honestly and briefly, handle concerns, and help the buyer decide.',
    'Never ask for card numbers or payment details. Payment happens on a secure Stripe page.',
    orderRule,
    'Reply in the language the buyer uses (Bangla or English).',
  ]
    .filter(Boolean)
    .join('\n')
}
