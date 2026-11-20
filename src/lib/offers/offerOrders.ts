import 'server-only'
import type Stripe from 'stripe'
import { OfferPriceKind, OrderModeKind, OrderStatus } from '@prisma/client'
import { stripe } from '@/lib/stripe'
import { prismaClient } from '@/lib/prismaClient'
import type { PublicOfferRecord } from './publicOffer'
import { scheduleDepositBalance } from './orderEvents'
import { publicBaseUrl } from './publicBaseUrl'

type CheckoutInput = {
  offer: PublicOfferRecord
  /** Price option id; falls back to the default option, then the legacy Stripe price. */
  offerPriceId: string | null
  contactId: string | null
  orderMode: OrderModeKind
  source: string | null
}

export type CheckoutStart = { ok: true; url: string; orderId: string } | { ok: false; error: string }

/** Stripe sends the buyer back here (the phone-reachable address in development). */
function baseUrl(): string {
  return publicBaseUrl()
}

/**
 * Creates the Order first, then a Stripe Checkout Session on the creator's connected account.
 * Amounts come from our OfferPrice rows (price_data), so creators never need dashboard products.
 *  - ONE_TIME: payment
 *  - MONTHLY: subscription
 *  - DEPOSIT: payment for the deposit; the card is saved so the balance can be invoiced (webhook, step 5)
 */
export async function startOfferCheckout(input: CheckoutInput): Promise<CheckoutStart> {
  const { offer } = input
  if (!offer.live || !offer.stripeAccount) return { ok: false, error: 'This offer is not taking payments right now' }

  const price = input.offerPriceId
    ? await prismaClient.offerPrice.findFirst({ where: { id: input.offerPriceId, webinarId: offer.id, active: true } })
    : await prismaClient.offerPrice.findFirst({
        where: { webinarId: offer.id, active: true, kind: { not: OfferPriceKind.DEPOSIT } },
        orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
      })
  if (input.offerPriceId && !price) return { ok: false, error: 'That price is no longer available' }

  const contact = input.contactId
    ? await prismaClient.contact.findFirst({
        where: { id: input.contactId, userId: offer.creatorUserId },
        select: { id: true, email: true },
      })
    : null

  let lineItem: Stripe.Checkout.SessionCreateParams.LineItem
  let mode: Stripe.Checkout.SessionCreateParams.Mode = 'payment'
  let amountTotalCents = 0
  const currency = price?.currency ?? 'usd'

  if (price?.stripePriceId && price.amountCents && price.kind !== OfferPriceKind.DEPOSIT) {
    // Picked from the creator's Stripe catalog: charge that exact price, so Stripe's products and
    // reports match what was sold.
    amountTotalCents = price.amountCents
    if (price.kind === OfferPriceKind.MONTHLY) mode = 'subscription'
    lineItem = { quantity: 1, price: price.stripePriceId }
  } else if (price?.amountCents) {
    amountTotalCents = price.amountCents
    if (price.kind === OfferPriceKind.MONTHLY) {
      mode = 'subscription'
      lineItem = {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: price.amountCents,
          recurring: { interval: 'month' },
          product_data: { name: offer.title },
        },
      }
    } else if (price.kind === OfferPriceKind.DEPOSIT && price.depositCents) {
      lineItem = {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: price.depositCents,
          product_data: { name: `${offer.title} — deposit` },
        },
      }
    } else {
      lineItem = {
        quantity: 1,
        price_data: { currency, unit_amount: price.amountCents, product_data: { name: offer.title } },
      }
    }
  } else if (price?.stripePriceId || offer.legacyPriceId) {
    lineItem = { quantity: 1, price: (price?.stripePriceId || offer.legacyPriceId) as string }
  } else {
    return { ok: false, error: 'This offer has no price yet' }
  }

  const order = await prismaClient.order.create({
    data: {
      userId: offer.creatorUserId,
      webinarId: offer.id,
      offerPriceId: price?.id ?? null,
      contactId: contact?.id ?? null,
      orderMode: input.orderMode,
      source: input.source,
      currency,
      amountTotalCents,
    },
    select: { id: true },
  })

  const isDeposit = price?.kind === OfferPriceKind.DEPOSIT
  const metadata = { orderId: order.id, webinarId: offer.id, ...(price ? { offerPriceId: price.id } : {}) }
  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode,
        line_items: [lineItem],
        metadata,
        client_reference_id: order.id,
        ...(contact?.email ? { customer_email: contact.email } : {}),
        ...(mode === 'payment' ? { customer_creation: 'always' as const } : {}),
        ...(mode === 'subscription' ? { subscription_data: { metadata } } : {}),
        ...(isDeposit ? { payment_intent_data: { setup_future_usage: 'off_session' as const, metadata } } : {}),
        success_url: `${baseUrl()}/o/${offer.slug}?order=${order.id}`,
        cancel_url: `${baseUrl()}/o/${offer.slug}?canceled=1`,
      },
      { stripeAccount: offer.stripeAccount },
    )
    await prismaClient.order.update({ where: { id: order.id }, data: { stripeCheckoutSessionId: session.id } })
    if (!session.url) throw new Error('Stripe returned no checkout URL')
    return { ok: true, url: session.url, orderId: order.id }
  } catch (error) {
    console.error('[startOfferCheckout]', error instanceof Error ? error.message : error)
    await prismaClient.order.update({ where: { id: order.id }, data: { status: OrderStatus.FAILED } })
    return { ok: false, error: 'Could not open checkout. Please try again.' }
  }
}

/**
 * Applies a completed Checkout Session to its Order. Idempotent; used by the webhook and by the
 * success redirect (so orders update even where webhooks are not forwarded, e.g. local dev).
 * A paid deposit then gets its balance invoice scheduled (retried here if an earlier try failed).
 */
export async function applyCheckoutSession(session: Stripe.Checkout.Session, stripeAccount: string): Promise<void> {
  const orderId = session.metadata?.orderId
  if (!orderId) return
  const paid = session.payment_status === 'paid' || session.payment_status === 'no_payment_required'
  if (!paid) return

  const order = await prismaClient.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, stripeInvoiceId: true, offerPrice: { select: { kind: true } } },
  })
  if (!order) return
  const isDeposit = order.offerPrice?.kind === OfferPriceKind.DEPOSIT

  if (order.status === OrderStatus.PENDING) {
    const idOf = (value: string | { id: string } | null) => (typeof value === 'string' ? value : (value?.id ?? null))
    await prismaClient.order.update({
      where: { id: order.id },
      data: {
        status: isDeposit ? OrderStatus.DEPOSIT_PAID : OrderStatus.PAID,
        amountPaidCents: session.amount_total ?? 0,
        paidAt: new Date(),
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: idOf(session.payment_intent),
        stripeSubscriptionId: idOf(session.subscription),
      },
    })
  }

  if (isDeposit && !order.stripeInvoiceId) {
    try {
      await scheduleDepositBalance(order.id, stripeAccount)
    } catch (error) {
      // The deposit is recorded; the next webhook delivery or success-page visit retries this.
      console.error('[applyCheckoutSession] balance invoice failed', order.id, error instanceof Error ? error.message : error)
    }
  }
}

/** Success-page check: re-reads the session from Stripe instead of trusting the redirect. */
export async function refreshOrderFromStripe(orderId: string, webinarId: string): Promise<OrderStatus | null> {
  const order = await prismaClient.order.findFirst({
    where: { id: orderId, webinarId },
    select: {
      status: true,
      stripeInvoiceId: true,
      stripeCheckoutSessionId: true,
      user: { select: { stripeConnectId: true } },
    },
  })
  if (!order) return null
  // PENDING: confirm payment. DEPOSIT_PAID without an invoice: retry the balance invoice.
  const needsWork =
    order.status === OrderStatus.PENDING || (order.status === OrderStatus.DEPOSIT_PAID && !order.stripeInvoiceId)
  if (!needsWork || !order.stripeCheckoutSessionId || !order.user.stripeConnectId) {
    return order.status
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(order.stripeCheckoutSessionId, {
      stripeAccount: order.user.stripeConnectId,
    })
    await applyCheckoutSession(session, order.user.stripeConnectId)
  } catch (error) {
    console.warn('[refreshOrderFromStripe]', error instanceof Error ? error.message : error)
  }
  const updated = await prismaClient.order.findUnique({ where: { id: orderId }, select: { status: true } })
  return updated?.status ?? null
}
