'use client'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { User } from '.prisma/client'
import React from 'react'
import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import PurpleIcon from '../PurpleIcon'
import STS2 from '@/icons/sts-2'
import { cn } from '@/lib/utils'

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
  // /home draws its cubes background behind the header, so the header is see-through there and
  // scrolls away with the page (a clear sticky bar would sit on top of the hero text).
  const overHero = pathname === '/home'
  return (
    <div
      className={cn(
        'w-full px-0 md:px-4 pt-4 md:pt-10 pb-3 md:pb-4 flex justify-between items-center gap-3 md:gap-4',
        overHero ? 'relative z-30 bg-transparent' : 'sticky top-0 z-30 bg-background',
      )}
    >
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
        <div className="flex gap-3 md:gap-6 items-center">
          <PurpleIcon className="hidden sm:flex">
            <STS2 className="w-8 h-8" />
          </PurpleIcon>
          {/* Paid creators add offers and services here; everyone else sees the packages. */}
          {user.subscription ? (
            <Button onClick={() => router.push('/projects?new=1', { scroll: false })}>+ Add service</Button>
          ) : (
            <HeaderSubscription />
          )}

        </div>
    </div>
  )
}

export default Header