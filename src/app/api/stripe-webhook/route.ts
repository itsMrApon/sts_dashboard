import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { changeAttendanceType } from '@/actions/attendance'
import { applySetupPayment, syncPlatformAccessByCustomer } from '@/lib/billing/platformPackages'
import { applyCheckoutSession } from '@/lib/offers/offerOrders'
import { applyChargeRefunded, applyInvoicePaid, applySubscriptionEnded } from '@/lib/offers/orderEvents'

/**
 * Two kinds of events arrive here:
 *  - Platform events (no `event.account`): creator packages ($49 setup, $499 monthly).
 *  - Connected-account events (`event.account` set): buyers paying a creator. Stripe only sends these
 *    to an endpoint registered for Connect events.
 * Every handler is idempotent, because Stripe retries and may deliver events more than once.
 */
/**
 * A Connect endpoint in the Stripe dashboard has its own signing secret, so both are accepted:
 * STRIPE_WEBHOOK_SECRET (platform endpoint) and STRIPE_CONNECT_WEBHOOK_SECRET (Connect endpoint).
 */
function constructEvent(body: string, signature: string | null): Stripe.Event {
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET]
    .map((secret) => secret?.trim())
    .filter((secret): secret is string => !!secret)
  if (!signature || secrets.length === 0) {
    throw new Error('Missing signature or webhook secret')
  }
  let lastError: unknown
  for (const secret of secrets) {
    try {
      return stripe.webhooks.constructEvent(body, signature, secret)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

function customerIdOf(value: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!value) return null
  return typeof value === 'string' ? value : value.id
}

async function handlePlatformEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      await applySetupPayment(event.data.object)
      return
    }
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const customerId = customerIdOf(event.data.object.customer)
      if (customerId) await syncPlatformAccessByCustomer(customerId)
      return
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const customerId = customerIdOf(event.data.object.customer)
      if (customerId) await syncPlatformAccessByCustomer(customerId)
      return
    }
    default:
      return
  }
}

async function handleConnectedAccountEvent(event: Stripe.Event, account: string): Promise<void> {
  switch (event.type) {
    case 'invoice.paid':
      await applyInvoicePaid(event.data.object)
      return
    case 'charge.refunded':
      await applyChargeRefunded(event.data.object, account)
      return
    case 'customer.subscription.deleted':
      await applySubscriptionEnded(event.data.object)
      return
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      break
    default:
      return
  }
  const session = event.data.object
  // Share-link checkouts (/o, /pay) carry an orderId; a paid deposit also gets its balance invoice.
  await applyCheckoutSession(session, account)
  // `attendeeld` is the misspelled key older checkout sessions were created with.
  const attendeeId = session.metadata?.attendeeId ?? session.metadata?.attendeeld
  const webinarId = session.metadata?.webinarId
  if (attendeeId && webinarId && session.payment_status === 'paid') {
    await changeAttendanceType(attendeeId, webinarId, 'CONVERTED')
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = (await headers()).get('stripe-signature')

  let event: Stripe.Event
  try {
    event = constructEvent(body, signature)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid payload'
    console.error('[stripe-webhook] signature check failed:', message)
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 })
  }

  try {
    if (event.account) {
      await handleConnectedAccountEvent(event, event.account)
    } else {
      await handlePlatformEvent(event)
    }
    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    // 500 makes Stripe retry; handlers are idempotent.
    console.error('[stripe-webhook] handler failed', event.type, error instanceof Error ? error.message : error)
    return new NextResponse('Webhook handler failed', { status: 500 })
  }
}
