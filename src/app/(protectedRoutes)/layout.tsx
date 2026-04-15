import React from 'react'
import { onAuthenticateUser } from '../../actions/auth'
import Sidebar from '@/components/ReusableComponent/LayoutComponent/Sidebar'
import { redirect } from 'next/navigation'
import Header from '@/components/ReusableComponent/LayoutComponent/Header'

type Props = {
  children: React.ReactNode
}

/**
 * Protected layout: auth-only. Stripe/Vapi/LiveKit are not fetched here so that
 * routes that don't need them (e.g. /messages, /lead, /settings) get fast TTFB.
 * Header loads that data client-side only when the Create flow is needed.
 */
const Layout = async ({ children }: Props) => {
  const userExists = await onAuthenticateUser()

  if (!userExists.user) {
    redirect('/sign-in')
  }

  return (
    <div className='flex w-full min-h-screen'>
      <Sidebar />
      <div className="flex flex-col w-full min-h-screen overflow-x-hidden px-4 scrollbar-hide container mx-auto">
        <Header user={userExists.user} />
        <div className="flex-1 py-10">
          {children}
        </div>
      </div>
    </div>
  )
}
export default Layout