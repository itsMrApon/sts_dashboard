import React from 'react'
import { onAuthenticateUser } from '../../actions/auth'
import Sidebar from '@/components/ReusableComponent/LayoutComponent/Sidebar'
import { redirect } from 'next/navigation'
import Header from '@/components/ReusableComponent/LayoutComponent/Header'
import { getAllProductsFromStripe } from '@/actions/stripe'
import { getAllAssistants } from '@/actions/vapi'

type Props = {
  children: React.ReactNode
}

const Layout = async ({ children }: Props) => {
  const userExists = await onAuthenticateUser()
  
  if (!userExists.user) {
    redirect('/sign-in')
  }

  const stripeProducts = await getAllProductsFromStripe()
  const assistants = await getAllAssistants()

  return (
    <div className='flex w-full min-h-screen'>
      {/* sidebar */}
      <Sidebar />
      
      <div className="flex flex-col w-full h-screen overflow-auto px-4 scrollbar-hide container mx-auto">
        {/* header  */}
        <Header 
          user={userExists.user}
         stripeProducts={stripeProducts.products || []}
         assistants={assistants.data || []}
        />
        
        <div className="flex-1 py-10">
        {children}
        </div>
      </div>
    </div>
  )
}
export default Layout