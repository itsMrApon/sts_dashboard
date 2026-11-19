import 'server-only'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { prismaClient } from '@/lib/prismaClient'
import {
  isOneTimePackage,
  isPlatformPackageId,
  LEGACY_ONE_TIME_PACKAGES,
  PLATFORM_PACKAGE_IDS,
  PLATFORM_PACKAGES,
  type PlatformPackageId,
} from '@/lib/billing/planCatalog'

export * from '@/lib/billing/planCatalog'

/**
 * Billing for the six creator plans (catalog in planCatalog.ts), charged on the platform Stripe
 * account, not on Connect. Stripe is the record of what was bought: a monthly plan is a subscription
 * on the plan's lookup-key price, a one-time plan is a succeeded PaymentIntent tagged with the plan.
 * `User.subscription` stays the one access flag the app checks; it is always derived here.
 */

/** Subscription states that keep access. past_due keeps access while Stripe retries the card. */
const ACCESS_STATUSES = new Set<Stripe.Subscription.Status>(['active', 'trialing', 'past_due'])

const LOOKUP_KEY_PLANS = new Map<string, PlatformPackageId>(
  PLATFORM_PACKAGE_IDS.map((id) => [PLATFORM_PACKAGES[id].lookupKey, id]),
)

/** Monthly price ids already resolved in this server instance (they never change for a lookup key). */
const resolvedMonthlyPrices = new Map<PlatformPackageId, string>()

/**
 * The Stripe price a monthly plan subscribes to: found by lookup key, created once when missing,
 * and checked against the catalog amount so the price shown is the price charged.
 */
export async function ensureMonthlyPlanPrice(packageId: PlatformPackageId): Promise<string> {
  const meta = PLATFORM_PACKAGES[packageId]
  if (meta.billing !== 'month') throw new Error(`${packageId} is not a monthly plan`)
  const cached = resolvedMonthlyPrices.get(packageId)
  if (cached) return cached

  const find = async () =>
    (await stripe.prices.list({ lookup_keys: [meta.lookupKey], active: true, limit: 1 })).data[0]
  let price = await find()
  if (!price) {
    try {
      const product = await stripe.products.create({ name: `sts-ai ${meta.name}`, description: meta.tagline })
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: meta.amountCents,
        currency: 'usd',
        recurring: { interval: 'month' },
        lookup_key: meta.lookupKey,
      })
    } catch (error) {
      // Another request created it first (lookup keys are unique): use that one.
      price = await find()
      if (!price) throw error
    }
  }
  if (price.unit_amount !== meta.amountCents || price.recurring?.interval !== 'month') {
    throw new Error(`Stripe price ${meta.lookupKey} does not match the catalog (${meta.amountCents}/month)`)
  }
  resolvedMonthlyPrices.set(packageId, price.id)
  return price.id
}

/** The monthly plan a subscription is on, read from its price lookup key (or the metadata we set). */
function planOfSubscription(sub: Stripe.Subscription): PlatformPackageId | null {
  for (const item of sub.items.data) {
    const plan = item.price.lookup_key ? LOOKUP_KEY_PLANS.get(item.price.lookup_key) : undefined
    if (plan) return plan
  }
  const tagged = sub.metadata?.package
  return isPlatformPackageId(tagged) && !isOneTimePackage(tagged) ? tagged : null
}

/** The one-time plan a payment bought, including payments made under the earlier catalog. */
function planOfPayment(intent: Stripe.PaymentIntent): PlatformPackageId | null {
  const tagged = intent.metadata?.package
  if (isPlatformPackageId(tagged)) return isOneTimePackage(tagged) ? tagged : null
  return (tagged && LEGACY_ONE_TIME_PACKAGES[tagged]) || null
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
 * `businessSubscription*` hold the monthly plan subscription (the higher-priced plan wins).
 * Any other active platform subscription (prices from earlier catalogs) keeps access too,
 * and so does access granted by hand to a customer Stripe has no subscriptions for.
 */
export async function syncPlatformAccess(userId: string): Promise<PlatformAccess | null> {
  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true, setupPaidAt: true, subscription: true },
  })
  if (!user) return null

  // Higher is better: an access-granting subscription first, then the higher-priced plan.
  const rank = (sub: Stripe.Subscription) => {
    const plan = planOfSubscription(sub)
    return (ACCESS_STATUSES.has(sub.status) ? 1_000_000 : 0) + (plan ? PLATFORM_PACKAGES[plan].amountCents : 0)
  }
  let business: Stripe.Subscription | null = null
  let legacyActive = false
  let sawAnySubscription = false

  if (user.stripeCustomerId) {
    // status 'all' includes canceled ones, so an ended subscription is seen and can revoke access.
    const subs = await stripe.subscriptions.list({ customer: user.stripeCustomerId, status: 'all', limit: 20 })
    sawAnySubscription = subs.data.length > 0
    for (const sub of subs.data) {
      if (planOfSubscription(sub)) {
        // Prefer a subscription that grants access over an abandoned incomplete one.
        if (!business || rank(sub) > rank(business)) business = sub
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
 * Records a succeeded one-time plan payment (Launchpad or Liftoff): stamps setupPaidAt (first
 * payment wins) and opens a SetupRequest for the team, noting the plan. Idempotent per PaymentIntent.
 */
export async function applySetupPayment(paymentIntent: Stripe.PaymentIntent): Promise<boolean> {
  const userId = paymentIntent.metadata?.userId
  const packageId = paymentIntent.metadata?.package
  if (!isPlatformPackageId(packageId) || !isOneTimePackage(packageId) || !userId || paymentIntent.status !== 'succeeded') {
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
      create: { userId, stripePaymentIntentId: paymentIntent.id, notes: `Plan: ${PLATFORM_PACKAGES[packageId].name}` },
    }),
  ])
  await syncPlatformAccess(userId)
  return true
}

/**
 * The plans this creator bought, read from Stripe: monthly plans by an access-granting subscription
 * on their price, one-time plans by a succeeded payment tagged with the plan. setupPaidAt alone
 * (a setup paid before payments were tagged) counts as Launchpad.
 */
export async function loadOwnedPackages(user: {
  stripeCustomerId: string | null
  setupPaidAt: Date | null
}): Promise<Set<PlatformPackageId>> {
  const owned = new Set<PlatformPackageId>()
  if (user.stripeCustomerId) {
    try {
      const [subs, intents] = await Promise.all([
        stripe.subscriptions.list({ customer: user.stripeCustomerId, status: 'all', limit: 20 }),
        stripe.paymentIntents.list({ customer: user.stripeCustomerId, limit: 50 }),
      ])
      for (const sub of subs.data) {
        const plan = ACCESS_STATUSES.has(sub.status) ? planOfSubscription(sub) : null
        if (plan) owned.add(plan)
      }
      for (const intent of intents.data) {
        const plan = intent.status === 'succeeded' ? planOfPayment(intent) : null
        if (plan) owned.add(plan)
      }
    } catch (error) {
      console.error('[platformPackages] owned lookup failed', error instanceof Error ? error.message : error)
    }
  }
  if (user.setupPaidAt && !owned.has('LIFTOFF')) owned.add('LAUNCHPAD')
  return owned
}

/** The plan (bought) that already covers `packageId`, if any, so it is not sold twice. */
export function coveringPlan(packageId: PlatformPackageId, owned: Set<PlatformPackageId>): PlatformPackageId | null {
  return PLATFORM_PACKAGE_IDS.find((id) => owned.has(id) && PLATFORM_PACKAGES[id].includes.includes(packageId)) ?? null
}

/** What a one-time plan costs after credit for the one-time plans it includes that were already bought. */
export function oneTimeAmountDue(packageId: PlatformPackageId, owned: Set<PlatformPackageId>): number {
  const meta = PLATFORM_PACKAGES[packageId]
  const credit = meta.includes
    .filter((id) => isOneTimePackage(id) && owned.has(id))
    .reduce((sum, id) => sum + PLATFORM_PACKAGES[id].amountCents, 0)
  return Math.max(meta.amountCents - credit, 0)
}
