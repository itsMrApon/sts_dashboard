import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from '@/lib/stripe'
import { headers } from "next/headers";
import { updateSubscription } from "@/actions/stripe";

const STRIPE_SUBSCRIPTION_EVENTS = new Set([
  "invoice.created",
  "invoice.finalized",
  "invoice.paid",
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
])

const getStripeEvent = async (
  body: string, 
  sig: string | null
): Promise<Stripe.Event> => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    throw new Error('Missing signature or webhook secret')
  }
  return stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
}

export async function POST(req: NextRequest) {
  console.log('Received Stripe webhook event')
  const body = await req.text()

  const signature = (await headers()).get('stripe-signature')
  try {
    const stripeEvent = await getStripeEvent(body, signature)
    
    if (stripeEvent.type === 'invoice.paid') {
      const invoice = stripeEvent.data.object as Stripe.Invoice
      if (invoice.subscription) {
        const subscription = await stripe.subscriptions.retrieve(
          typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id
        )
        await updateSubscription(subscription)
      }
      return NextResponse.json({received: true}, {status: 200})
    }
    
    if (STRIPE_SUBSCRIPTION_EVENTS.has(stripeEvent.type)) {
      console.log('Handling subscription event', stripeEvent.type)
      return NextResponse.json({received: true}, {status: 200})
    }

    const event = stripeEvent.data.object as Stripe.Subscription
    const metadata = event.metadata

    if(
      metadata.connectAccountPayments || metadata.connectAccountSubscriptions
    )
    {
      console.log('Handling connect account event', stripeEvent.type)
      return NextResponse.json(
        {message: 'Skipping connected account event'}, 
        {status: 200}
      )
    }
    
    switch(stripeEvent.type) {
      case 'checkout.session.completed':
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await updateSubscription(event)
        console.log('Created from webhook 💳', event)
        return NextResponse.json({received: true}, {status: 200})
      default:
        console.log('Unhandled event type', stripeEvent.type)
        return NextResponse.json({received: true}, {status: 200})
    }


  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const statusCode = (error as { statusCode?: number })?.statusCode || 500
    console.error('Error 🦺 processing webhook', errorMessage)
    return new NextResponse(`Webhook Error: ${errorMessage}`, {
      status: statusCode,
    })
  }
}