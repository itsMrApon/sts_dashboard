
import { LucideAlertCircle, LucideArrowRight, LucideCheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import React from 'react'
import { redirect } from 'next/navigation'
import { onAuthenticateUser } from '@/actions/auth'
import { getStripeAuthLink } from '@/lib/stripe/utils'

type Props = {}

const page = async (props: Props) => {

  const userExist = await onAuthenticateUser ()
  if(!userExist.user) {
    redirect('/sign-in')
  }
  const isConnected = !!userExist?.user?.stripeConnectId

  const stripelink = getStripeAuthLink(
    "/api/stripe-connect", 
    userExist.user.id
  );

  return (
    <div className="w-full mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Payment Integration</h1>
      <div className="w-full p-6 border border-input rounded-lg bg-background shadow-sm">
        <div className="flex items-center mb-4">
          <div className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center mr-4">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            height="24" 
            viewBox="0 0 24 24" 
            width="24">
              <path 
                d="M0 0h24v24H0z" 
                fill="none"/>
              <path 
                d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-primary">Stripe Connect</h2>
            <p className="text-muted-foreground text-sm">
              Connect your Stripe account to start accepting webinars payments
            </p>
          </div>
        </div>
        <div className="my-6 p-4 bg-muted rounded-md">
          <div className="flex items-start">
            {isConnected ? (
              <LucideCheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
            ) : (
              <LucideAlertCircle className="h-5 w-5 text-amber-500 mt-0.5 mr-3 flex-shrink-0" />
            )}
            <div>
              <p className="font-medium">
                {isConnected
                ? 'Connected to Stripe' 
                : 'Not connected to Stripe yet'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {isConnected
                ? 'Your Stripe account is connected and ready to accept payments'
                : 'Connect your Stripe account to start accepting projects payments'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            {isConnected
            ? 'You can reconnect anytime if needed'
            : "You'll be redirected to Stripe to complete the connection process"}
          </div>
          {/* add the stripe connect button */}
          <Link
            href={stripelink}
            className={`px-5 py-2.5 rounded-md font-medium text-sm flex items-center gap-2 transition-colors ${
              isConnected
              ? 'bg-muted hover:bg-muted/80 text-foreground'
              : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white'
            }`}
          >
            {isConnected ? 'Reconnect' : 'Connect with Stripe'}
            <LucideArrowRight size={16} />
          </Link>
        </div>
        {!isConnected &&(
          <div className="mt-6 pt-6 border-t border-border">
            <h3 className="text-sm font-medium mb-2">
              Why connect your Stripe account?
            </h3>
            <ul className="text-sm text-muted-foreground space-y-2" >
              <li className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-green-100 flex items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500">
                  </div>
                </div>
                Process payments securely from customers worldwide
              </li>
              <li className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-green-100 flex items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500">
                  </div>
                </div>
                Manage subscriptions and recurring billing
              </li>
              <li className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-green-100 flex items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500">
                  </div>
                </div>
                Get detailed transaction reports and analytics
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

export default page