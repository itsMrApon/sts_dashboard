'use client'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { User } from '.prisma/client'
import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import PurpleIcon from '../PurpleIcon'
import STS2 from '@/icons/sts-2'
import type Stripe from 'stripe'
import type { Assistant } from '@vapi-ai/server-sdk/api'
import type { LiveKitUiAgentConfig } from '@/lib/livekit/livekitTypes'

const CreateWebinarButton = dynamic(
  () => import('../CreateWebinarButton').then((m) => m.default),
  { ssr: false, loading: () => <div className="h-9 w-20 rounded-md bg-muted animate-pulse" /> }
)

const HeaderSubscription = dynamic(
  () => import('./HeaderSubscription').then((m) => m.default),
  { ssr: false, loading: () => <div className="h-9 w-24 rounded-md bg-muted animate-pulse" /> }
)

type Props = {
  user: User
}

const Header = ({ user }: Props) => {
  const pathname = usePathname()
  const router = useRouter()
  const [stripeProducts, setStripeProducts] = useState<Stripe.Product[]>([])
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [livekitAgents, setLivekitAgents] = useState<LiveKitUiAgentConfig[]>([])

  useEffect(() => {
    if (!user.subscription) return
    let mounted = true
    const load = async () => {
      const [
        { getAllProductsFromStripe },
        { getAllAssistants },
        { getLiveKitAgents },
      ] = await Promise.all([
        import('@/actions/stripe'),
        import('@/actions/vapi'),
        import('@/actions/livekitAgent'),
      ])
      if (!mounted) return
      const [stripeRes, vapiRes, livekitRes] = await Promise.allSettled([
        getAllProductsFromStripe(),
        getAllAssistants(),
        getLiveKitAgents(),
      ])
      if (!mounted) return
      if (stripeRes.status === 'fulfilled' && stripeRes.value?.products) setStripeProducts(stripeRes.value.products)
      if (vapiRes.status === 'fulfilled' && Array.isArray(vapiRes.value?.data)) setAssistants(vapiRes.value.data)
      if (livekitRes.status === 'fulfilled' && livekitRes.value?.success && Array.isArray(livekitRes.value?.data)) {
        setLivekitAgents(livekitRes.value.data)
      }
    }
    load()
    return () => { mounted = false }
  }, [user.subscription])


  return (
    <div className="w-full px-4 pt-10 pb-4 sticky top-0 z-10 flex justify-between items-center flex-wrap gap-4 bg-background">
        {pathname.includes('pipeline') ? (
          <Button
          className="bg-primary/10 border border-border rounded-xl" 
          variant="outline" onClick={() => router.push('/projects')}
          >
          <ArrowLeft /> Back to Projects
          </Button>
        ): (
        <div className="px-4 py-2 flex justify-center text-bold items-center rounded-xl bg-background border border-border text-primary capitalize">
          {pathname.split('/')[1]}
          </div>
        )}
        {/* create todo and create a booking button */}
        <div className="flex gap-6 items-center flex-wrap">
          <PurpleIcon>
            <STS2 className="w-8 h-8" />
          </PurpleIcon>
          {/* TODO: Add stripe subscription and create webinar button */}
          {user.subscription? (
            <CreateWebinarButton 
              stripeProducts={stripeProducts} 
              assistants={assistants}
              livekitAgents={livekitAgents}
            />
          ) : (
            <HeaderSubscription user={user} />
          )}

        </div>
    </div>
  )
}

export default Header