import React from 'react'
import { onAuthenticateUser } from '../../actions/auth'
import Sidebar from '@/components/ReusableComponent/LayoutComponent/Sidebar'
import MobileNav from '@/components/ReusableComponent/LayoutComponent/MobileNav'
import { redirect } from 'next/navigation'
import Header from '@/components/ReusableComponent/LayoutComponent/Header'
import { startPerf, timeAsync } from '@/lib/dev/perf'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'

type Props = {
  children: React.ReactNode
}

/**
 * Protected layout: auth-only. Stripe/Vapi/LiveKit are not fetched here so that
 * routes that don't need them (e.g. /messages, /lead, /settings) get fast TTFB.
 * Header loads that data client-side only when the Create flow is needed.
 */
const Layout = async ({ children }: Props) => {
  const timer = startPerf('route.layout.protected')
  const userExists = await timeAsync('route.layout.protected.auth', () =>
    onAuthenticateUser(),
  )

  if (!userExists.user) {
    redirect('/sign-in')
  }

  // Single-business model: every creator names their business once before using the app.
  const business = await timeAsync('route.layout.protected.business', () =>
    getCreatorBusiness(userExists.user!.id),
  )
  if (!business) {
    redirect('/onboarding')
  }

  const rendered = (
    <div className="flex w-full min-h-screen">
      <Sidebar />
      {/* min-w-0: lets wide children shrink instead of pushing the page sideways on phones. */}
      <div className="container mx-auto flex w-full min-w-0 min-h-screen flex-col overflow-x-hidden px-4 scrollbar-hide">
        <Header user={userExists.user} />
        {/* pb-24 on phones keeps the last content above the bottom tab bar. */}
        <div className="flex-1 pt-6 pb-24 md:py-10">{children}</div>
      </div>
      <MobileNav />
    </div>
  )
  timer.end()
  return rendered
}
export default Layout
