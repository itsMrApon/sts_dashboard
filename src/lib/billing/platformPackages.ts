import 'server-only'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { prismaClient } from '@/lib/prismaClient'

/**
 * The four plans sold to creators (charged on the platform Stripe account, not on Connect), on two
 * switches: what they get (SITE: the business site; FULL: every AI tool) and how they get it
 * (INTEGRATION: one-time, the team sets it up; SOLUTIONS: monthly, the team runs it with them).
 *  - SETUP:     Site · Integration          one-time (the original "Setup & Integrate" price)
 *  - SITE_CARE: Site · Business Solutions   monthly
 *  - AI_SETUP:  Full AI · Integration       one-time
 *  - BUSINESS:  Full AI · Business Solutions monthly (the original "Run My Business" price)
 * Prices live in Stripe (one env price id each). `User.subscription` stays the one access flag the
 * app checks; it is always derived here.
 */
export type PlatformPackageId = 'SETUP' | 'SITE_CARE' | 'AI_SETUP' | 'BUSINESS'
export type PlanTier = 'SITE' | 'FULL'
export type PlanMode = 'INTEGRATION' | 'SOLUTIONS'

export const PLATFORM_PACKAGE_IDS: readonly PlatformPackageId[] = ['SETUP', 'SITE_CARE', 'AI_SETUP', 'BUSINESS']

/** One-time packages (a PaymentIntent, recorded as a SetupRequest for the team). */
export const ONE_TIME_PACKAGE_IDS: readonly PlatformPackageId[] = ['SETUP', 'AI_SETUP']

export type PlatformPackageMeta = {
  name: string
  tagline: string
  features: string[]
  priceEnv: string
  billing: 'one_time' | 'month'
  tier: PlanTier
  mode: PlanMode
}

export const PLATFORM_PACKAGES: Record<PlatformPackageId, PlatformPackageMeta> = {
  SETUP: {
    name: 'Site Launch',
    tagline: 'We build and publish your business site.',
    features: [
      'Business site built and published for you',
      'Your products, services and links on it',
      'Lead form that sends callbacks to your inbox',
      'Share link ready for WhatsApp, email and social',
    ],
    priceEnv: 'STRIPE_SETUP_PRICE_ID',
    billing: 'one_time',
    tier: 'SITE',
    mode: 'INTEGRATION',
  },
  SITE_CARE: {
    name: 'Site Care',
    tagline: 'Your site, kept fresh and followed up every month.',
    features: [
      'Everything in Site Launch',
      'Monthly edits to your site and offers',
      'We follow up on new leads with you',
      'Monthly report: visits, leads and sales',
    ],
    priceEnv: 'STRIPE_SITE_CARE_PRICE_ID',
    billing: 'month',
    tier: 'SITE',
    mode: 'SOLUTIONS',
  },
  AI_SETUP: {
    name: 'AI Launch',
    tagline: 'Every AI tool, set up for your business.',
    features: [
      'Everything in Site Launch',
      'Chat AI and Voice AI trained on your business',
      'Voice-guided tour of your website',
      'Products, webinars and Stripe payments set up',
      'Website embed installed, plus a handover call',
    ],
    priceEnv: 'STRIPE_AI_SETUP_PRICE_ID',
    billing: 'one_time',
    tier: 'FULL',
    mode: 'INTEGRATION',
  },
  BUSINESS: {
    name: 'Run My Business',
    tagline: 'Your AI business, run with you every month.',
    features: [
      'Everything in AI Launch',
      'We tune your AI and offers every month',
      'Lead research and outreach for you',
      'Monthly strategy call and priority support',
    ],
    priceEnv: 'STRIPE_BUSINESS_PRICE_ID',
    billing: 'month',
    tier: 'FULL',
    mode: 'SOLUTIONS',
  },
}

/** The one-time package whose fee a monthly plan of the same tier waives (shown crossed out). */
export const WAIVED_SETUP: Partial<Record<PlatformPackageId, PlatformPackageId>> = {
  SITE_CARE: 'SETUP',
  BUSINESS: 'AI_SETUP',
}

/** Subscription states that keep access. past_due keeps access while Stripe retries the card. */
const ACCESS_STATUSES = new Set<Stripe.Subscription.Status>(['active', 'trialing', 'past_due'])

export function isPlatformPackageId(value: unknown): value is PlatformPackageId {
  return PLATFORM_PACKAGE_IDS.includes(value as PlatformPackageId)
}

export function isOneTimePackage(packageId: PlatformPackageId): boolean {
  return PLATFORM_PACKAGES[packageId].billing === 'one_time'
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

/** Stripe price id → monthly plan, for the monthly plans whose price is configured. */
export function monthlyPlanPriceIds(): Map<string, PlatformPackageId> {
  const ids = new Map<string, PlatformPackageId>()
  for (const id of PLATFORM_PACKAGE_IDS) {
    const meta = PLATFORM_PACKAGES[id]
    const priceId = process.env[meta.priceEnv]?.trim()
    if (meta.billing === 'month' && priceId) ids.set(priceId, id)
  }
  return ids
}

/**
 * Recomputes access from the DB setup payment and the customer's Stripe subscriptions.
 * Idempotent: safe to call from the webhook and after a client-side confirmation.
 * `businessSubscription*` hold the monthly plan subscription (Run My Business wins over Site Care).
 * Any other active platform subscription (the legacy $49/month price) keeps access too,
 * and so does access granted by hand to a customer Stripe has no subscriptions for.
 */
export async function syncPlatformAccess(userId: string): Promise<PlatformAccess | null> {
  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true, setupPaidAt: true, subscription: true },
  })
  if (!user) return null

  const planPrices = monthlyPlanPriceIds()
  const planOf = (sub: Stripe.Subscription) =>
    sub.items.data.map((item) => planPrices.get(item.price.id)).find(Boolean) ?? null
  // Higher is better: an access-granting subscription first, then Run My Business over Site Care.
  const rank = (sub: Stripe.Subscription) =>
    (ACCESS_STATUSES.has(sub.status) ? 2 : 0) + (planOf(sub) === 'BUSINESS' ? 1 : 0)
  let business: Stripe.Subscription | null = null
  let legacyActive = false
  let sawAnySubscription = false

  if (user.stripeCustomerId) {
    // status 'all' includes canceled ones, so an ended subscription is seen and can revoke access.
    const subs = await stripe.subscriptions.list({ customer: user.stripeCustomerId, status: 'all', limit: 20 })
    sawAnySubscription = subs.data.length > 0
    for (const sub of subs.data) {
      if (planOf(sub)) {
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
 * Records a succeeded one-time plan payment (Site Launch or AI Launch): stamps setupPaidAt (first
 * payment wins) and opens a SetupRequest for the team, noting the plan. Idempotent per PaymentIntent.
 */
export async function applySetupPayment(paymentIntent: Stripe.PaymentIntent): Promise<boolean> {
  const userId = paymentIntent.metadata?.userId
  const packageId = paymentIntent.metadata?.package
  if (
    !isPlatformPackageId(packageId) ||
    !isOneTimePackage(packageId) ||
    !userId ||
    paymentIntent.status !== 'succeeded'
  ) {
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
 * The plans this creator holds, read from Stripe: monthly plans by an access-granting subscription
 * on their price, one-time plans by a succeeded payment tagged with the package. Purchases made
 * before AI Launch existed were all Site Launch, so setupPaidAt alone still counts as SETUP.
 */
export async function loadOwnedPackages(user: {
  stripeCustomerId: string | null
  setupPaidAt: Date | null
}): Promise<Set<PlatformPackageId>> {
  const owned = new Set<PlatformPackageId>()
  if (user.stripeCustomerId) {
    try {
      const planPrices = monthlyPlanPriceIds()
      const [subs, intents] = await Promise.all([
        stripe.subscriptions.list({ customer: user.stripeCustomerId, status: 'all', limit: 20 }),
        stripe.paymentIntents.list({ customer: user.stripeCustomerId, limit: 50 }),
      ])
      for (const sub of subs.data) {
        if (!ACCESS_STATUSES.has(sub.status)) continue
        for (const item of sub.items.data) {
          const plan = planPrices.get(item.price.id)
          if (plan) owned.add(plan)
        }
      }
      for (const intent of intents.data) {
        const plan = intent.metadata?.package
        if (intent.status === 'succeeded' && isPlatformPackageId(plan) && isOneTimePackage(plan)) owned.add(plan)
      }
    } catch (error) {
      console.error('[platformPackages] owned lookup failed', error instanceof Error ? error.message : error)
    }
  }
  if (user.setupPaidAt && !owned.has('AI_SETUP')) owned.add('SETUP')
  return owned
}
