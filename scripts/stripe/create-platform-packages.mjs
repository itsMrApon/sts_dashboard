// Creates (or finds) the four platform plan prices on the platform Stripe account and prints the env lines.
//   node --env-file=.env scripts/stripe/create-platform-packages.mjs          # test mode only
//   node --env-file=.env scripts/stripe/create-platform-packages.mjs --live   # explicitly allow a live key
// Idempotent: prices are found again by lookup_key, so re-running never duplicates them.
import Stripe from 'stripe'

const key = process.env.STRIPE_SECRET_KEY
if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
if (key.startsWith('sk_live') && !process.argv.includes('--live')) {
  throw new Error('Refusing to create live prices without --live')
}

const stripe = new Stripe(key)

const PACKAGES = [
  {
    env: 'STRIPE_SETUP_PRICE_ID',
    lookupKey: 'sts_setup_integrate_v1',
    product: { name: 'sts-ai Setup & Integrate', description: 'One-time done-for-you setup' },
    price: { unit_amount: 4900, currency: 'usd' },
  },
  {
    env: 'STRIPE_SITE_CARE_PRICE_ID',
    lookupKey: 'sts_site_care_monthly_v1',
    product: { name: 'sts-ai Site Care', description: 'Monthly site care and lead follow-up' },
    price: { unit_amount: 9900, currency: 'usd', recurring: { interval: 'month' } },
  },
  {
    env: 'STRIPE_AI_SETUP_PRICE_ID',
    lookupKey: 'sts_ai_launch_v1',
    product: { name: 'sts-ai AI Launch', description: 'One-time setup of every AI tool' },
    price: { unit_amount: 99900, currency: 'usd' },
  },
  {
    env: 'STRIPE_BUSINESS_PRICE_ID',
    lookupKey: 'sts_run_my_business_monthly_v1',
    product: { name: 'sts-ai Run My Business', description: 'Monthly managed plan' },
    price: { unit_amount: 49900, currency: 'usd', recurring: { interval: 'month' } },
  },
]

for (const pkg of PACKAGES) {
  const found = await stripe.prices.list({ lookup_keys: [pkg.lookupKey], active: true, limit: 1 })
  let price = found.data[0]
  if (!price) {
    const product = await stripe.products.create(pkg.product)
    price = await stripe.prices.create({ ...pkg.price, product: product.id, lookup_key: pkg.lookupKey })
  }
  console.log(`${pkg.env}=${price.id}`)
}
