import React from 'react'
import { onAuthenticateUser } from '../../actions/auth'
import Sidebar from '@/components/ReusableComponent/LayoutComponent/Sidebar'
import { redirect } from 'next/navigation'

type Props = {
  children: React.ReactNode
}

const Layout = async ({ children }: Props) => {
  const userExists = await onAuthenticateUser()
  
  if (!userExists.user) {
    redirect('/sign-in')
  }

  return (
    <div className='flex w-full min-h-screen'>
      {/* sidebar */}
      <Sidebar />
      
      <div className="flex flex-col w-full h-screen overflow-auto px-4 scrollbar-hide container mx-auto">
        {children}
      </div>
    </div>
  )
}
export default Layout