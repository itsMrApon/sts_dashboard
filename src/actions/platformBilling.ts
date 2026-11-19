'use server'

import type Stripe from 'stripe'
import { revalidatePath } from 'next/cache'
import { onAuthenticateUser } from '@/actions/auth'
import { stripe } from '@/lib/stripe'
import {
  applySetupPayment,
  coveringPlan,
  ensureMonthlyPlanPrice,
  ensureStripeCustomer,
  isOneTimePackage,
  isPlatformPackageId,
  loadOwnedPackages,
  oneTimeAmountDue,
  PLATFORM_PACKAGE_IDS,
  PLATFORM_PACKAGES,
  syncPlatformAccess,
  type PlanBilling,
  type PlanModuleId,
  type PlatformAccess,
  type PlatformPackageId,
} from '@/lib/billing/platformPackages'

type PurchaseStart =
  | { ok: true; clientSecret: string; paymentIntentId: string }
  | { ok: false; error: string }

/**
 * Starts a plan purchase and returns a PaymentIntent client secret for the card form.
 * One-time plans (Launchpad, Liftoff) are a PaymentIntent for the catalog amount, less credit for
 * an included plan already bought; monthly plans are a subscription created as default_incomplete
 * (the app's original subscription flow).
 */
export async function startPackagePurchase(packageId: PlatformPackageId): Promise<PurchaseStart> {
  if (!isPlatformPackageId(packageId)) return { ok: false, error: 'Unknown package' }

  const auth = await onAuthenticateUser()
  if (!auth.user) return { ok: false, error: 'Please sign in again' }
  const user = auth.user

  const meta = PLATFORM_PACKAGES[packageId]
  const owned = await loadOwnedPackages(user)
  if (owned.has(packageId)) return { ok: false, error: `${meta.name} is already ${isOneTimePackage(packageId) ? 'purchased' : 'active'}` }
  const coveredBy = coveringPlan(packageId, owned)
  if (coveredBy) return { ok: false, error: `${meta.name} is already included in ${PLATFORM_PACKAGES[coveredBy].name}` }
  // One monthly plan at a time: switching between them is done by the team, not a second subscription.
  const otherMonthly = PLATFORM_PACKAGE_IDS.find((id) => id !== packageId && !isOneTimePackage(id) && owned.has(id))
  if (!isOneTimePackage(packageId) && otherMonthly) {
    return { ok: false, error: `You already have ${PLATFORM_PACKAGES[otherMonthly].name}. Contact us to switch plans.` }
  }

  try {
    const customerId = await ensureStripeCustomer(user)
    const metadata: Record<string, string> = { userId: user.id, package: packageId }

    if (isOneTimePackage(packageId)) {
      const intent = await stripe.paymentIntents.create({
        amount: oneTimeAmountDue(packageId, owned),
        currency: 'usd',
        customer: customerId,
        payment_method_types: ['card'],
        description: `sts-ai ${meta.name}`,
        metadata: { ...metadata, lookupKey: meta.lookupKey },
      })
      if (!intent.client_secret) throw new Error('Missing client secret')
      return { ok: true, clientSecret: intent.client_secret, paymentIntentId: intent.id }
    }

    const priceId = await ensureMonthlyPlanPrice(packageId)
    if (meta.minimumMonths) metadata.minimumMonths = String(meta.minimumMonths)
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata,
      ...(meta.minimumMonths ? { description: `${meta.minimumMonths}-month minimum term` } : {}),
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
  track: string
  tagline: string
  features: string[]
  modules: PlanModuleId[]
  billing: PlanBilling
  /** Catalog price in cents (USD). */
  amountCents: number
  /** What this creator pays now: one-time plans less credit for an included plan already bought. */
  dueCents: number
  currency: string
  priceLabel: string
  /** Monthly plans: the one-time plan whose fee they waive (shown crossed out). */
  waivedSetup: { name: string; amountCents: number } | null
  minimumMonths: number | null
  owned: boolean
  /** Name of a bought plan that already includes this one. */
  includedIn: string | null
}

function formatAmount(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

/** The six plan cards for the settings page and the header dialog, priced from the catalog. */
export async function getPackageCards(): Promise<PackageCard[]> {
  const auth = await onAuthenticateUser()
  const user = auth.user
  const owned = user ? await loadOwnedPackages(user) : new Set<PlatformPackageId>()

  return PLATFORM_PACKAGE_IDS.map((id) => {
    const meta = PLATFORM_PACKAGES[id]
    const coveredBy = coveringPlan(id, owned)
    const waived = meta.waivesSetup ? PLATFORM_PACKAGES[meta.waivesSetup] : null
    const amount = formatAmount(meta.amountCents)
    return {
      id,
      name: meta.name,
      track: meta.track,
      tagline: meta.tagline,
      features: meta.features,
      modules: meta.modules,
      billing: meta.billing,
      amountCents: meta.amountCents,
      dueCents: meta.billing === 'one_time' ? oneTimeAmountDue(id, owned) : meta.amountCents,
      currency: 'usd',
      priceLabel: meta.billing === 'month' ? `${amount}/month` : `${amount} one-time`,
      waivedSetup: waived ? { name: waived.name, amountCents: waived.amountCents } : null,
      minimumMonths: meta.minimumMonths ?? null,
      owned: owned.has(id),
      includedIn: coveredBy ? PLATFORM_PACKAGES[coveredBy].name : null,
    }
  })
}
