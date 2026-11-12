"use server"

import type Stripe from 'stripe'
import { OfferPriceKind } from '@prisma/client'
import { onAuthenticateUser } from '@/actions/auth'
import { stripe } from '@/lib/stripe'
import { prismaClient } from '@/lib/prismaClient'
import { pickDefaultPrice } from '@/lib/offers/offerSettings'
import { changeAttendanceType } from './attendance'

export const getAllProductsFromStripe = async () => {
  try {
    const currentUser = await onAuthenticateUser()
    if (!currentUser.user) {
      return {
        error: "user are Unauthorized",
        status: 401,
        success: false,
      }
    }
    if (!currentUser.user.stripeConnectId) {
      return {
        error: "user are not connected to stripe",
        status: 401,
        success: false,
      }
    }
    const products = await stripe.products.list(
      {},
      {
        stripeAccount: currentUser.user.stripeConnectId,
      }
    )
    return {
      products: products.data,
      status: 200,
      success: true,
    }
  } catch (error) {
    console.log('Error getting products from Stripe', error)
    return {
      error: "Error getting products from Stripe",
      status: 500,
      success: false,
    }
  }
}

// Platform packages ($49 setup / $499 monthly) live in src/actions/platformBilling.ts.

/**
 * Buyer checkout for an offer. The price and the creator's Stripe account are resolved on the
 * server from the project (never taken from the browser): the creator's default price option
 * when set, otherwise the legacy Stripe price.
 */
export const createCheckoutLink = async (
  projectId: string,
  attendeeId: string,
  bookCall: boolean = false
) => {
  try {
    const project = await prismaClient.webinar.findFirst({
      where: { id: projectId, deletedAt: null },
      select: {
        id: true,
        title: true,
        priceId: true,
        presenter: { select: { stripeConnectId: true } },
        prices: { where: { active: true } },
      },
    })
    const stripeAccount = project?.presenter.stripeConnectId
    if (!project || !stripeAccount) {
      return { error: 'Checkout is not set up for this offer', status: 400, success: false }
    }

    const price = pickDefaultPrice(project.prices)
    let lineItem: Stripe.Checkout.SessionCreateParams.LineItem
    let mode: Stripe.Checkout.SessionCreateParams.Mode = 'payment'
    if (price?.amountCents) {
      const monthly = price.kind === OfferPriceKind.MONTHLY
      mode = monthly ? 'subscription' : 'payment'
      lineItem = {
        quantity: 1,
        price_data: {
          currency: price.currency,
          unit_amount: price.amountCents,
          product_data: { name: project.title },
          ...(monthly ? { recurring: { interval: 'month' as const } } : {}),
        },
      }
    } else if (price?.stripePriceId || project.priceId) {
      lineItem = { quantity: 1, price: (price?.stripePriceId || project.priceId) as string }
    } else {
      return { error: 'Set a price for this offer first', status: 400, success: false }
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    const session = await stripe.checkout.sessions.create(
      {
        line_items: [lineItem],
        mode,
        success_url: `${baseUrl}/`,
        cancel_url: `${baseUrl}/`,
        metadata: {
          attendeeId,
          webinarId: project.id,
          ...(price ? { offerPriceId: price.id } : {}),
        },
      },
      { stripeAccount }
    )
    if (bookCall) {
      await changeAttendanceType(attendeeId, projectId, 'ADDED_TO_CART' )
    }
    return {
      sessionUrl: session.url,
      status: 200,
      success: true,
    }
  } catch (error) {
    console.error('Create checkout link error:', error)
    return {
      error: "Failed to create checkout link",
      status: 500,
      success: false,
    }
  }
}