"use server"

import { onAuthenticateUser } from '@/actions/auth'
import { subscriptionPriceId } from '@/lib/data'
import { prismaClient } from '@/lib/prismaClient'
import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'

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

export const onGetStripeClientSecret = async (email: string, userId: string) => {
  try {
    let customer: Stripe.Customer;
    const existingCustomers = await stripe.customers.list({ email: email });
    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0]
    }else {
      customer = await stripe.customers.create({ 
        email: email,
        metadata: {
          userId: userId,
        },
      })
    }
    await prismaClient.user.update({
      where: { id: userId },
      data: {
        stripeCustomerId: customer.id,
      },
    })
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: subscriptionPriceId}], 
      payment_behavior: 'default_incomplete', 
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        userId: userId,
      },
    })

    const invoice = subscription.latest_invoice as Stripe.Invoice
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent
    
    if (!paymentIntent || !paymentIntent.client_secret) {
      throw new Error('Payment intent not found in subscription invoice')
    }
    
    return {
      status: 200,
      secret: paymentIntent.client_secret, 
      customerId: customer.id,
    }
  } catch (error) {
    console.error('Subscription creation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create subscription'
    return { status: 400, message: errorMessage }
  }
}

export const updateSubscription = async (subscription: Stripe.Subscription) => {
  try {
    const userID = subscription.metadata.userId
    
    await prismaClient.user.update({
      where: { id: userID },
      data: {
        subscription: subscription.status === 'active' ? true : false,
      },
    })
  } catch (error) {
    console.error('Subscription update error:', error)
  }
}

export const syncSubscriptionStatus = async (userId: string) => {
  try {
    const user = await prismaClient.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    })

    if (!user?.stripeCustomerId) {
      return { success: false, message: 'No Stripe customer ID found' }
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'active',
      limit: 1,
    })

    if (subscriptions.data.length > 0) {
      const subscription = subscriptions.data[0]
      await prismaClient.user.update({
        where: { id: userId },
        data: {
          subscription: true,
        },
      })
      return { success: true, subscription: subscription.status }
    }

    return { success: false, message: 'No active subscription found' }
  } catch (error) {
    console.error('Sync subscription error:', error)
    return { success: false, message: 'Failed to sync subscription' }
  }
}