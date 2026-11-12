import 'server-only'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { prismaClient } from '@/lib/prismaClient'

/**
 * Platform packages sold to creators (charged on the platform Stripe account, not on Connect):
 *  - SETUP:    "Setup & Integrate", one-time ($49). The team sets the creator up.
 *  - BUSINESS: "Run My Business", monthly ($499).
 * `User.subscription` stays the one access flag the app checks; it is always derived here.
 */
export type PlatformPackageId = 'SETUP' | 'BUSINESS'

export const PLATFORM_PACKAGE_IDS: readonly PlatformPackageId[] = ['SETUP', 'BUSINESS']

export const PLATFORM_PACKAGES: Record<
  PlatformPackageId,
  { name: string; tagline: string; features: string[]; priceEnv: string; billing: 'one_time' | 'month' }
> = {
  SETUP: {
    name: 'Setup & Integrate',
    tagline: 'We set everything up for you',
    features: [
      'Stripe connection and your first offer',
      'AI agent configured for your business',
      'Website embed installed',
    ],
    priceEnv: 'STRIPE_SETUP_PRICE_ID',
    billing: 'one_time',
  },
  BUSINESS: {
    name: 'Run My Business',
    tagline: 'We run it with you, every month',
    features: [
      'Everything in Setup & Integrate',
      'Ongoing offer, AI and payment management',
      'Priority support',
    ],
    priceEnv: 'STRIPE_BUSINESS_PRICE_ID',
    billing: 'month',
  },
}

/** Subscription states that keep access. past_due keeps access while Stripe retries the card. */
const ACCESS_STATUSES = new Set<Stripe.Subscription.Status>(['active', 'trialing', 'past_due'])

export function isPlatformPackageId(value: unknown): value is PlatformPackageId {
  return value === 'SETUP' || value === 'BUSINESS'
}

export type PackagePrice = {
  priceId: string
  unitAmount: number
  currency: string
  billing: 'one_time' | 'month'
}

/** Resolves and validates the Stripe price behind a package. Returns null when not configured. */
export async function getPackagePrice(packageId: PlatformPackageId): Promise<PackagePrice | null> {
  const meta = PLATFORM_PACKAGES[packageId]
  const priceId = process.env[meta.priceEnv]?.trim()
  if (!priceId) return null
  try {
    const price = await stripe.prices.retrieve(priceId)
    if (!price.active || price.unit_amount == null) return null
    const billing = price.recurring ? price.recurring.interval : 'one_time'
    if (billing !== meta.billing) {
      console.error(`[platformPackages] ${meta.priceEnv} must be ${meta.billing}, got ${billing}`)
      return null
    }
    return { priceId, unitAmount: price.unit_amount, currency: price.currency, billing: meta.billing }
  } catch (error) {
    console.error('[platformPackages] price lookup failed', packageId, error instanceof Error ? error.message : error)
    return null
  }
}

export async function ensureStripeCustomer(user: {
  id: string
  email: string
  name: string
  stripeCustomerId: string | null
}): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId
  const existing = await stripe.customers.list({ email: user.email, limit: 1 })
  const customer =
    existing.data[0] ??
    (await stripe.customers.create({ email: user.email, name: user.name, metadata: { userId: user.id } }))
  await prismaClient.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } })
  return customer.id
}

export type PlatformAccess = {
  subscription: boolean
  setupPaidAt: Date | null
  businessActive: boolean
  businessSubscriptionStatus: string | null
}

/**
 * Recomputes access from the DB setup payment and the customer's Stripe subscriptions.
 * Idempotent: safe to call from the webhook and after a client-side confirmation.
 * Any other active platform subscription (the legacy $49/month price) keeps access too,
 * and so does access granted by hand to a customer Stripe has no subscriptions for.
 */
export async function syncPlatformAccess(userId: string): Promise<PlatformAccess | null> {
  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true, setupPaidAt: true, subscription: true },
  })
  if (!user) return null

  const businessPriceId = process.env[PLATFORM_PACKAGES.BUSINESS.priceEnv]?.trim()
  let business: Stripe.Subscription | null = null
  let legacyActive = false
  let sawAnySubscription = false

  if (user.stripeCustomerId) {
    // status 'all' includes canceled ones, so an ended subscription is seen and can revoke access.
    const subs = await stripe.subscriptions.list({ customer: user.stripeCustomerId, status: 'all', limit: 20 })
    sawAnySubscription = subs.data.length > 0
    for (const sub of subs.data) {
      const isBusiness = !!businessPriceId && sub.items.data.some((item) => item.price.id === businessPriceId)
      if (isBusiness) {
        // Prefer a subscription that grants access over an abandoned incomplete one.
        if (!business || (ACCESS_STATUSES.has(sub.status) && !ACCESS_STATUSES.has(business.status))) {
          business = sub
        }
      } else if (ACCESS_STATUSES.has(sub.status)) {
        legacyActive = true
      }
    }
  }

  const businessActive = !!business && ACCESS_STATUSES.has(business.status)
  const derived = !!user.setupPaidAt || businessActive || legacyActive
  const access: PlatformAccess = {
    // Access granted outside Stripe (no subscription ever seen) is kept; only an ended Stripe
    // subscription or a missing payment revokes it.
    subscription: derived || (user.subscription && !sawAnySubscription),
    setupPaidAt: user.setupPaidAt,
    businessActive,
    businessSubscriptionStatus: business?.status ?? null,
  }

  await prismaClient.user.update({
    where: { id: userId },
    data: {
      subscription: access.subscription,
      businessSubscriptionId: business?.id ?? null,
      businessSubscriptionStatus: business?.status ?? null,
    },
  })
  return access
}

export async function syncPlatformAccessByCustomer(customerId: string): Promise<void> {
  const user = await prismaClient.user.findFirst({ where: { stripeCustomerId: customerId }, select: { id: true } })
  if (user) {
    await syncPlatformAccess(user.id)
    return
  }
  const customer = await stripe.customers.retrieve(customerId)
  const userId = !customer.deleted ? customer.metadata?.userId : undefined
  if (userId) await syncPlatformAccess(userId)
}

/**
 * Records a succeeded "Setup & Integrate" payment: stamps setupPaidAt (first payment wins)
 * and opens a SetupRequest for the team. Idempotent per PaymentIntent.
 */
export async function applySetupPayment(paymentIntent: Stripe.PaymentIntent): Promise<boolean> {
  const userId = paymentIntent.metadata?.userId
  if (paymentIntent.metadata?.package !== 'SETUP' || !userId || paymentIntent.status !== 'succeeded') {
    return false
  }
  await prismaClient.$transaction([
    prismaClient.user.updateMany({
      where: { id: userId, setupPaidAt: null },
      data: { setupPaidAt: new Date(paymentIntent.created * 1000) },
    }),
    prismaClient.setupRequest.upsert({
      where: { stripePaymentIntentId: paymentIntent.id },
      update: {},
      create: { userId, stripePaymentIntentId: paymentIntent.id },
    }),
  ])
  await syncPlatformAccess(userId)
  return true
}
