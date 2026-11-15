import Stripe from 'stripe'
import { lazyClient, requireEnv } from '@/lib/lazyClient'

export const stripe = lazyClient(
  () =>
    new Stripe(requireEnv('STRIPE_SECRET_KEY'), {
      apiVersion: '2025-02-24.acacia',
      appInfo: { name: 'Leaderboard Saas', version: '0.1.0' },
    }),
)
