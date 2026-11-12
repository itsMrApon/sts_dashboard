'use server'

import type Stripe from 'stripe'
import { revalidatePath } from 'next/cache'
import { onAuthenticateUser } from '@/actions/auth'
import { stripe } from '@/lib/stripe'
import {
  applySetupPayment,
  ensureStripeCustomer,
  getPackagePrice,
  isPlatformPackageId,
  PLATFORM_PACKAGES,
  syncPlatformAccess,
  type PlatformAccess,
  type PlatformPackageId,
} from '@/lib/billing/platformPackages'

type PurchaseStart =
  | { ok: true; clientSecret: string; paymentIntentId: string }
  | { ok: false; error: string }

/**
 * Starts a package purchase and returns a PaymentIntent client secret for the card form.
 * SETUP is a one-time PaymentIntent; BUSINESS is a subscription created as default_incomplete
 * (same flow the app used for the original subscription).
 */
export async function startPackagePurchase(packageId: PlatformPackageId): Promise<PurchaseStart> {
  if (!isPlatformPackageId(packageId)) return { ok: false, error: 'Unknown package' }

  const auth = await onAuthenticateUser()
  if (!auth.user) return { ok: false, error: 'Please sign in again' }
  const user = auth.user

  if (packageId === 'SETUP' && user.setupPaidAt) {
    return { ok: false, error: 'Setup & Integrate is already purchased' }
  }
  if (packageId === 'BUSINESS' && user.businessSubscriptionStatus === 'active') {
    return { ok: false, error: 'Run My Business is already active' }
  }

  const price = await getPackagePrice(packageId)
  if (!price) {
    return { ok: false, error: `${PLATFORM_PACKAGES[packageId].name} is not available yet` }
  }

  try {
    const customerId = await ensureStripeCustomer(user)
    const metadata = { userId: user.id, package: packageId }

    if (packageId === 'SETUP') {
      const intent = await stripe.paymentIntents.create({
        amount: price.unitAmount,
        currency: price.currency,
        customer: customerId,
        payment_method_types: ['card'],
        description: PLATFORM_PACKAGES.SETUP.name,
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
    if (input.packageId === 'SETUP') {
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
  priceLabel: string | null
  owned: boolean
}

/** Package cards for the settings page and the header dialog. priceLabel is null when not configured. */
export async function getPackageCards(): Promise<PackageCard[]> {
  const auth = await onAuthenticateUser()
  const user = auth.user
  const prices = await Promise.all([getPackagePrice('SETUP'), getPackagePrice('BUSINESS')])

  return (['SETUP', 'BUSINESS'] as const).map((id, index) => {
    const meta = PLATFORM_PACKAGES[id]
    const price = prices[index]
    const amount = price
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: price.currency.toUpperCase(),
          maximumFractionDigits: price.unitAmount % 100 === 0 ? 0 : 2,
        }).format(price.unitAmount / 100)
      : null
    return {
      id,
      name: meta.name,
      tagline: meta.tagline,
      features: meta.features,
      priceLabel: amount ? (meta.billing === 'month' ? `${amount}/month` : `${amount} one-time`) : null,
      owned:
        id === 'SETUP'
          ? !!user?.setupPaidAt
          : user?.businessSubscriptionStatus === 'active' || user?.businessSubscriptionStatus === 'trialing',
    }
  })
}
