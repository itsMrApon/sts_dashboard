import {
  LucideAlertCircle,
  LucideArrowRight,
  LucideCheckCircle2,
} from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { onAuthenticateUser } from '@/actions/auth'
import { getStripeAuthLink } from '@/lib/stripe/utils'
import { prismaClient } from '@/lib/prismaClient'
import {
  googleCalendarNeedsReconnect,
  resolveGoogleOAuthCredentials,
} from '@/lib/leads/googleCalendar'
import { resolveSerperApiKey } from '@/lib/leads/webResearch'
import { decryptToken } from '@/lib/messages/encrypt'
import { LeadApiSettings } from './_components/LeadApiSettings'

export default async function SettingsPage() {
  const userExist = await onAuthenticateUser()
  if (!userExist.user) {
    redirect('/sign-in')
  }
  const isConnected = !!userExist?.user?.stripeConnectId

  const stripelink = getStripeAuthLink(
    '/api/stripe-connect',
    userExist.user.id,
  )

  const [connections, settings, googleOAuth, serperKey] = await Promise.all([
    prismaClient.callIntelConnection.findMany({
      where: { userId: userExist.user.id },
      select: {
        provider: true,
        status: true,
        metadata: true,
        credentials: true,
      },
    }),
    prismaClient.callIntelSettings.findUnique({
      where: { userId: userExist.user.id },
      select: {
        googleClientIdEnc: true,
        googleClientSecretEnc: true,
        serperApiKeyEnc: true,
        calendarFilterMode: true,
        calendarKeyword: true,
      },
    }),
    resolveGoogleOAuthCredentials(userExist.user.id),
    resolveSerperApiKey(userExist.user.id),
  ])

  const fathomOk = connections.some(
    (c) => c.provider === 'FATHOM' && c.status === 'ACTIVE',
  )
  const gcalConn = connections.find((c) => c.provider === 'GOOGLE_CALENDAR')
  const gcalOk = Boolean(gcalConn && gcalConn.status === 'ACTIVE')
  const refreshToken = gcalConn?.credentials
    ? decryptToken(
        (gcalConn.credentials as { refreshToken?: string }).refreshToken,
      )
    : null
  const gcalNeedsReconnect = googleCalendarNeedsReconnect(
    gcalConn || null,
    refreshToken,
    googleOAuth?.clientId,
  )

  return (
    <div className="mx-auto w-full px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Payment Integration</h1>

      <div className="border-input bg-background w-full rounded-lg border p-6 shadow-sm">
        <div className="mb-4 flex items-center">
          <div className="mr-4 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-indigo-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="24"
              viewBox="0 0 24 24"
              width="24"
            >
              <path d="M0 0h24v24H0z" fill="none" />
              <path
                d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"
                className="fill-white"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-primary text-xl font-semibold">
              Stripe Connect
            </h2>
            <p className="text-muted-foreground text-sm">
              Connect your Stripe account to start accepting webinars payments
            </p>
          </div>
        </div>

        <div className="bg-muted my-6 rounded-md p-4">
          <div className="flex items-start">
            {isConnected ? (
              <LucideCheckCircle2 className="mt-0.5 mr-3 h-5 w-5 shrink-0 text-green-500" />
            ) : (
              <LucideAlertCircle className="mt-0.5 mr-3 h-5 w-5 shrink-0 text-amber-500" />
            )}
            <div>
              <p className="font-medium">
                {isConnected
                  ? 'Connected to Stripe'
                  : 'Not connected to Stripe yet'}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {isConnected
                  ? 'Your Stripe account is connected and ready to accept payments'
                  : 'Connect your Stripe account to start accepting projects payments'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="text-muted-foreground text-sm">
            {isConnected
              ? 'You can reconnect anytime if needed'
              : "You'll be redirected to Stripe to complete the connection process"}
          </div>
          <Link
            href={stripelink}
            className={`flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium transition-colors ${
              isConnected
                ? 'bg-muted text-foreground hover:bg-muted/80'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'
            }`}
          >
            {isConnected ? 'Reconnect' : 'Connect with Stripe'}
            <LucideArrowRight size={16} />
          </Link>
        </div>

        {!isConnected ? (
          <div className="border-border mt-6 border-t pt-6">
            <h3 className="mb-2 text-sm font-medium">
              Why connect your Stripe account?
            </h3>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-green-100">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                </div>
                Process payments securely from customers worldwide
              </li>
              <li className="flex items-center gap-2">
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-green-100">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                </div>
                Manage subscriptions and recurring billing
              </li>
              <li className="flex items-center gap-2">
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-green-100">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                </div>
                Get detailed transaction reports and analytics
              </li>
            </ul>
          </div>
        ) : null}
      </div>

      <div className="mt-10">
        <h1 className="mb-6 text-2xl font-bold">Connections</h1>
        <LeadApiSettings
          fathomOk={fathomOk}
          gcalOk={gcalOk}
          gcalNeedsReconnect={gcalNeedsReconnect}
          googleOAuthConfigured={Boolean(googleOAuth)}
          hasUserGoogleOAuth={Boolean(
            settings?.googleClientIdEnc && settings?.googleClientSecretEnc,
          )}
          serperConfigured={Boolean(serperKey)}
          hasUserSerperKey={Boolean(settings?.serperApiKeyEnc)}
          calendarFilterMode={
            settings?.calendarFilterMode === 'KEYWORD' ? 'KEYWORD' : 'ALL'
          }
          calendarKeyword={settings?.calendarKeyword || '[Sales]'}
        />
      </div>
    </div>
  )
}
