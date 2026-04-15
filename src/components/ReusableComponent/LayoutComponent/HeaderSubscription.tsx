'use client'

import React from 'react'
import { User } from '@prisma/client'
import { StripeElements } from '../Stripe/Element'
import SubscriptionModel from '../SubscriptionModel'

type Props = { user: User }

export default function HeaderSubscription({ user }: Props) {
  return (
    <StripeElements>
      <SubscriptionModel user={user} />
    </StripeElements>
  )
}
