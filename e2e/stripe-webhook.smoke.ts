import { expect, test } from '@playwright/test'
import Stripe from 'stripe'
import { hasWebhookEnv } from './env'

// Proves the webhook endpoint checks signatures with the same secret the app has.
// The signed event is a type the app ignores, so it changes no data.

test.describe('stripe webhook', () => {
  test.skip(!hasWebhookEnv(), 'STRIPE_WEBHOOK_SECRET not set')

  // Signing is local: this key is never used to call Stripe.
  const stripe = new Stripe('sk_test_smoke_unused')

  test('rejects an unsigned event', async ({ request }) => {
    const response = await request.post('/api/stripe-webhook', {
      data: JSON.stringify({ id: 'evt_smoke', type: 'customer.created' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(response.status()).toBe(400)
  })

  test('accepts a correctly signed event', async ({ request }) => {
    const payload = JSON.stringify({
      id: `evt_smoke_${Date.now()}`,
      object: 'event',
      type: 'smoke.test',
      api_version: '2025-01-27.acacia',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 0,
      request: { id: null, idempotency_key: null },
      data: { object: { id: 'smoke', object: 'smoke' } },
    })
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET!.trim(),
    })
    const response = await request.post('/api/stripe-webhook', {
      data: payload,
      headers: { 'content-type': 'application/json', 'stripe-signature': signature },
    })
    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual({ received: true })
  })
})
