'use server'

import type Stripe from 'stripe'
import { revalidatePath } from 'next/cache'
import { onAuthenticateUser } from '@/actions/auth'
import { stripe } from '@/lib/stripe'
import {
  applySetupPayment,
  ensureStripeCustomer,
  getPackagePrice,
  isOneTimePackage,
  isPlatformPackageId,
  loadOwnedPackages,
  PLATFORM_PACKAGE_IDS,
  PLATFORM_PACKAGES,
  syncPlatformAccess,
  WAIVED_SETUP,
  type PlanMode,
  type PlanTier,
  type PlatformAccess,
  type PlatformPackageId,
} from '@/lib/billing/platformPackages'

type PurchaseStart =
  | { ok: true; clientSecret: string; paymentIntentId: string }
  | { ok: false; error: string }

/**
 * Starts a plan purchase and returns a PaymentIntent client secret for the card form.
 * One-time plans (Site Launch, AI Launch) are a PaymentIntent; monthly plans (Site Care, Run My
 * Business) are a subscription created as default_incomplete (the app's original subscription flow).
 */
export async function startPackagePurchase(packageId: PlatformPackageId): Promise<PurchaseStart> {
  if (!isPlatformPackageId(packageId)) return { ok: false, error: 'Unknown package' }

  const auth = await onAuthenticateUser()
  if (!auth.user) return { ok: false, error: 'Please sign in again' }
  const user = auth.user

  const meta = PLATFORM_PACKAGES[packageId]
  const owned = await loadOwnedPackages(user)
  if (owned.has(packageId)) return { ok: false, error: `${meta.name} is already ${isOneTimePackage(packageId) ? 'purchased' : 'active'}` }
  // One monthly plan at a time: switching between them is done by the team, not a second subscription.
  const otherMonthly = PLATFORM_PACKAGE_IDS.find((id) => id !== packageId && !isOneTimePackage(id) && owned.has(id))
  if (!isOneTimePackage(packageId) && otherMonthly) {
    return { ok: false, error: `You already have ${PLATFORM_PACKAGES[otherMonthly].name}. Contact us to switch plans.` }
  }

  const price = await getPackagePrice(packageId)
  if (!price) {
    return { ok: false, error: `${meta.name} is not available yet` }
  }

  try {
    const customerId = await ensureStripeCustomer(user)
    const metadata = { userId: user.id, package: packageId }

    if (isOneTimePackage(packageId)) {
      const intent = await stripe.paymentIntents.create({
        amount: price.unitAmount,
        currency: price.currency,
        customer: customerId,
        payment_method_types: ['card'],
        description: meta.name,
        metadata: { ...metadata, priceId: price.priceId },
      })
      if (!intent.client_secret) throw new Error('Missing client secret')
      return { ok: true, clientSecret: intent.client_secret, paymentIntentId: intent.id }
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price.priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata,
    })
    const invoice = subscription.latest_invoice as Stripe.Invoice | null
    const intent = invoice?.payment_intent as Stripe.PaymentIntent | null
    if (!intent?.client_secret) throw new Error('Missing client secret')
    return { ok: true, clientSecret: intent.client_secret, paymentIntentId: intent.id }
  } catch (error) {
    console.error('[startPackagePurchase]', packageId, error instanceof Error ? error.message : error)
    return { ok: false, error: 'Could not start the payment. Please try again.' }
  }
}

/**
 * Called after the card is confirmed in the browser so access updates without waiting for the webhook.
 * Only trusts the PaymentIntent after re-reading it from Stripe and matching it to the signed-in user.
 */
export async function confirmPackagePurchase(input: {
  packageId: PlatformPackageId
  paymentIntentId: string
}): Promise<{ ok: true; access: PlatformAccess } | { ok: false; error: string }> {
  if (!isPlatformPackageId(input.packageId)) return { ok: false, error: 'Unknown package' }
  const auth = await onAuthenticateUser()
  if (!auth.user) return { ok: false, error: 'Please sign in again' }

  try {
    if (isOneTimePackage(input.packageId)) {
      const intent = await stripe.paymentIntents.retrieve(input.paymentIntentId)
      if (intent.metadata?.userId !== auth.user.id) return { ok: false, error: 'Payment not found' }
      if (!(await applySetupPayment(intent))) return { ok: false, error: 'Payment has not completed yet' }
    }
    const access = await syncPlatformAccess(auth.user.id)
    if (!access) return { ok: false, error: 'Account not found' }
    revalidatePath('/', 'layout')
    return { ok: true, access }
  } catch (error) {
    console.error('[confirmPackagePurchase]', error instanceof Error ? error.message : error)
    return { ok: false, error: 'Payment received, but access is still updating. Refresh in a minute.' }
  }
}

export type PackageCard = {
  id: PlatformPackageId
  name: string
  tagline: string
  features: string[]
  tier: PlanTier
  mode: PlanMode
  billing: 'one_time' | 'month'
  /** Smallest currency unit; null when the plan's Stripe price is not configured. */
  amountCents: number | null
  currency: string
  priceLabel: string | null
  /** Monthly plans: the one-time setup fee they waive (shown crossed out). */
  waivedSetupCents: number | null
  owned: boolean
}

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

/** The four plan cards for the settings page and the header dialog. priceLabel is null when not configured. */
export async function getPackageCards(): Promise<PackageCard[]> {
  const auth = await onAuthenticateUser()
  const user = auth.user
  const [prices, owned] = await Promise.all([
    Promise.all(PLATFORM_PACKAGE_IDS.map((id) => getPackagePrice(id))),
    user ? loadOwnedPackages(user) : Promise.resolve(new Set<PlatformPackageId>()),
  ])
  const priceOf = (id: PlatformPackageId) => prices[PLATFORM_PACKAGE_IDS.indexOf(id)]

  return PLATFORM_PACKAGE_IDS.map((id) => {
    const meta = PLATFORM_PACKAGES[id]
    const price = priceOf(id)
    const waived = WAIVED_SETUP[id]
    const amount = price ? formatAmount(price.unitAmount, price.currency) : null
    return {
      id,
      name: meta.name,
      tagline: meta.tagline,
      features: meta.features,
      tier: meta.tier,
      mode: meta.mode,
      billing: meta.billing,
      amountCents: price?.unitAmount ?? null,
      currency: price?.currency ?? 'usd',
      priceLabel: amount ? (meta.billing === 'month' ? `${amount}/month` : `${amount} one-time`) : null,
      waivedSetupCents: waived ? (priceOf(waived)?.unitAmount ?? null) : null,
      owned: owned.has(id),
    }
  })
}
