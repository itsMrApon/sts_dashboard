// Creates (or finds) the six platform plan prices on the platform Stripe account.
//   node --env-file=.env scripts/stripe/create-platform-packages.mjs          # test mode only
//   node --env-file=.env scripts/stripe/create-platform-packages.mjs --live   # explicitly allow a live key
// Idempotent: prices are found again by lookup_key, so re-running never duplicates them.
// The app finds prices by the same lookup keys (and creates a missing monthly one on first checkout),
// so no env vars are needed. Keep names, amounts and keys in sync with src/lib/billing/planCatalog.ts.
import Stripe from 'stripe'

const key = process.env.STRIPE_SECRET_KEY
if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
if (key.startsWith('sk_live') && !process.argv.includes('--live')) {
  throw new Error('Refusing to create live prices without --live')
}

const stripe = new Stripe(key)

const monthly = { recurring: { interval: 'month' } }
const PLANS = [
  { lookupKey: 'sts_launchpad_v1', name: 'Launchpad', amount: 4900 },
  { lookupKey: 'sts_liftoff_v1', name: 'Liftoff', amount: 7900 },
  { lookupKey: 'sts_signal_monthly_v1', name: 'Signal', amount: 11900, ...monthly },
  { lookupKey: 'sts_autopilot_monthly_v1', name: 'Autopilot', amount: 19900, ...monthly },
  { lookupKey: 'sts_mission_control_monthly_v1', name: 'Mission Control', amount: 39900, ...monthly },
  { lookupKey: 'sts_supernova_monthly_v1', name: 'Supernova', amount: 44900, ...monthly },
]

for (const plan of PLANS) {
  const found = await stripe.prices.list({ lookup_keys: [plan.lookupKey], active: true, limit: 1 })
  let price = found.data[0]
  if (!price) {
    const product = await stripe.products.create({ name: `sts-ai ${plan.name}` })
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.amount,
      currency: 'usd',
      lookup_key: plan.lookupKey,
      ...(plan.recurring ? { recurring: plan.recurring } : {}),
    })
  }
  const billing = price.recurring ? `/${price.recurring.interval}` : ' one-time'
  console.log(`${plan.name.padEnd(16)} $${(price.unit_amount / 100).toFixed(0)}${billing}  ${price.id}`)
}
