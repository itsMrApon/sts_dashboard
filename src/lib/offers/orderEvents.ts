import 'server-only'
import type Stripe from 'stripe'
import { OfferPriceKind, OrderStatus } from '@prisma/client'
import { stripe } from '@/lib/stripe'
import { prismaClient } from '@/lib/prismaClient'

/**
 * What happens to an Order after checkout, driven by Stripe events on the creator's connected
 * account. Stripe stays the source of truth for money; these handlers only mirror it and are
 * idempotent (Stripe retries, and the success page may run the same step as the webhook).
 */

const BALANCE_INVOICE_KIND = 'deposit_balance'
const DAY_SECONDS = 24 * 60 * 60

const idOf = (value: string | { id: string } | null | undefined): string | null =>
  typeof value === 'string' ? value : (value?.id ?? null)

/**
 * Deposit paid → invoice the rest. With the card saved at checkout, the invoice stays a draft
 * and Stripe finalizes and charges it on the due date. Without a saved card, Stripe emails the
 * invoice now with that due date. Stripe idempotency keys make concurrent calls create one invoice.
 */
export async function scheduleDepositBalance(orderId: string, stripeAccount: string): Promise<void> {
  const order = await prismaClient.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      currency: true,
      stripeInvoiceId: true,
      stripePaymentIntentId: true,
      stripeCheckoutSessionId: true,
      webinar: { select: { title: true } },
      offerPrice: { select: { kind: true, amountCents: true, depositCents: true, balanceDueDays: true } },
    },
  })
  const price = order?.offerPrice
  if (!order || order.status !== OrderStatus.DEPOSIT_PAID || order.stripeInvoiceId) return
  if (price?.kind !== OfferPriceKind.DEPOSIT || !price.amountCents || !price.depositCents) return

  const balance = price.amountCents - price.depositCents
  if (balance <= 0) return
  const days = price.balanceDueDays ?? 14
  const dueAt = Math.floor(Date.now() / 1000) + days * DAY_SECONDS
  const title = order.webinar?.title ?? 'Your order'

  // Customer and saved card come from the deposit payment.
  const paymentIntent = order.stripePaymentIntentId
    ? await stripe.paymentIntents.retrieve(order.stripePaymentIntentId, {}, { stripeAccount })
    : null
  const customer = idOf(paymentIntent?.customer)
  if (!customer) {
    console.error('[scheduleDepositBalance] no customer on deposit payment', order.id)
    return
  }
  const paymentMethod = idOf(paymentIntent?.payment_method)
  const metadata = { orderId: order.id, kind: BALANCE_INVOICE_KIND }

  const invoice = await stripe.invoices.create(
    {
      customer,
      currency: order.currency,
      description: `${title} — remaining balance`,
      metadata,
      pending_invoice_items_behavior: 'exclude',
      ...(paymentMethod
        ? {
            collection_method: 'charge_automatically' as const,
            default_payment_method: paymentMethod,
            auto_advance: true,
            automatically_finalizes_at: dueAt,
          }
        : { collection_method: 'send_invoice' as const, days_until_due: days }),
    },
    { stripeAccount, idempotencyKey: `balance-invoice-${order.id}` },
  )
  await stripe.invoiceItems.create(
    {
      customer,
      invoice: invoice.id,
      amount: balance,
      currency: order.currency,
      description: `${title} — balance`,
      metadata,
    },
    { stripeAccount, idempotencyKey: `balance-item-${order.id}` },
  )
  if (!paymentMethod) {
    // No saved card: send it now so the buyer can pay by the due date.
    await stripe.invoices.finalizeInvoice(invoice.id, {}, { stripeAccount, idempotencyKey: `balance-finalize-${order.id}` })
    await stripe.invoices.sendInvoice(invoice.id, {}, { stripeAccount, idempotencyKey: `balance-send-${order.id}` })
  }
  await prismaClient.order.update({ where: { id: order.id }, data: { stripeInvoiceId: invoice.id } })
}

/** invoice.paid: the deposit balance (→ PAID) or a monthly renewal (adds to amount paid). */
export async function applyInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  if (invoice.metadata?.kind === BALANCE_INVOICE_KIND && invoice.metadata.orderId) {
    const order = await prismaClient.order.findUnique({
      where: { id: invoice.metadata.orderId },
      select: { id: true, status: true, amountTotalCents: true },
    })
    if (!order || order.status === OrderStatus.PAID) return
    await prismaClient.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.PAID, amountPaidCents: order.amountTotalCents, stripeInvoiceId: invoice.id },
    })
    return
  }

  // Webhooks arrive in the account's API version: `invoice.subscription` (≤ acacia) moved to
  // `invoice.parent.subscription_details.subscription` (basil and later).
  const basil = invoice as unknown as { parent?: { subscription_details?: { subscription?: string | { id: string } } } }
  const subscriptionId = idOf(invoice.subscription) ?? idOf(basil.parent?.subscription_details?.subscription)
  if (!subscriptionId || invoice.billing_reason !== 'subscription_cycle') return
  const order = await prismaClient.order.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
    select: { id: true, stripeInvoiceId: true },
  })
  // The last counted invoice is stored, so a redelivered event is not counted twice.
  if (!order || order.stripeInvoiceId === invoice.id) return
  await prismaClient.order.update({
    where: { id: order.id },
    data: { amountPaidCents: { increment: invoice.amount_paid }, stripeInvoiceId: invoice.id, status: OrderStatus.PAID },
  })
}

/** Net collected on a PaymentIntent's charge (amount minus refunds), read fresh from Stripe. */
async function netCollected(paymentIntentId: string | null, stripeAccount: string): Promise<number> {
  if (!paymentIntentId) return 0
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] }, { stripeAccount })
  const charge = intent.latest_charge as Stripe.Charge | null
  return charge ? Math.max(0, charge.amount - charge.amount_refunded) : 0
}

/**
 * charge.refunded: recount what is still collected from Stripe instead of trusting one charge,
 * because a deposit order has two charges (deposit + balance invoice). Nothing left → REFUNDED.
 * Monthly orders only adjust on full refunds of their first payment (renewals are not tracked).
 */
export async function applyChargeRefunded(charge: Stripe.Charge, stripeAccount: string): Promise<void> {
  const paymentIntentId = idOf(charge.payment_intent)
  if (!paymentIntentId) return

  const select = {
    id: true,
    stripePaymentIntentId: true,
    stripeInvoiceId: true,
    stripeSubscriptionId: true,
    offerPrice: { select: { kind: true } },
  } as const
  let order = await prismaClient.order.findFirst({ where: { stripePaymentIntentId: paymentIntentId }, select })
  if (!order) {
    // The refunded charge may be the deposit balance invoice's payment.
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {}, { stripeAccount })
    const invoiceId = idOf(intent.invoice)
    order = invoiceId ? await prismaClient.order.findFirst({ where: { stripeInvoiceId: invoiceId }, select }) : null
  }
  if (!order) return

  if (order.stripeSubscriptionId) {
    if (charge.refunded) {
      await prismaClient.order.update({ where: { id: order.id }, data: { status: OrderStatus.REFUNDED, amountPaidCents: 0 } })
    }
    return
  }

  let collected = await netCollected(order.stripePaymentIntentId, stripeAccount)
  if (order.offerPrice?.kind === OfferPriceKind.DEPOSIT && order.stripeInvoiceId) {
    const invoice = await stripe.invoices.retrieve(order.stripeInvoiceId, {}, { stripeAccount })
    if (invoice.status === 'paid') collected += await netCollected(idOf(invoice.payment_intent), stripeAccount)
  }
  await prismaClient.order.update({
    where: { id: order.id },
    data: { amountPaidCents: collected, ...(collected === 0 ? { status: OrderStatus.REFUNDED } : {}) },
  })
}

/** customer.subscription.deleted: the monthly plan ended. */
export async function applySubscriptionEnded(subscription: Stripe.Subscription): Promise<void> {
  await prismaClient.order.updateMany({
    where: { stripeSubscriptionId: subscription.id, status: { notIn: [OrderStatus.REFUNDED, OrderStatus.CANCELED] } },
    data: { status: OrderStatus.CANCELED },
  })
}
