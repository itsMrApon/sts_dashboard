import React from 'react'
import { onAuthenticateUser } from '../../actions/auth'
import Sidebar from '@/components/ReusableComponent/LayoutComponent/Sidebar'
import { redirect } from 'next/navigation'
import Header from '@/components/ReusableComponent/LayoutComponent/Header'
import { startPerf, timeAsync } from '@/lib/dev/perf'

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

  const rendered = (
    <div className="flex w-full min-h-screen">
      <Sidebar />
      <div className="container mx-auto flex w-full min-h-screen flex-col overflow-x-hidden px-4 scrollbar-hide">
        <Header user={userExists.user} />
        <div className="flex-1 py-10">{children}</div>
      </div>
    </div>
  )
  timer.end()
  return rendered
}
export default Layout
