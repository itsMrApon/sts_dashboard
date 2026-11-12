'use client'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { User } from '.prisma/client'
import React from 'react'
import Link from 'next/link'
import { Building2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import PurpleIcon from '../PurpleIcon'
import STS2 from '@/icons/sts-2'
const AddServiceDialog = dynamic(
  () => import('../AddService/AddServiceDialog').then((m) => m.default),
  { ssr: false, loading: () => <div className="h-9 w-28 rounded-xl bg-muted animate-pulse" /> }
)

const HeaderSubscription = dynamic(
  () => import('./HeaderSubscription').then((m) => m.default),
  { ssr: false, loading: () => <div className="h-9 w-24 rounded-md bg-muted animate-pulse" /> }
)

type Props = {
  user: User
  businessName: string
}

const Header = ({ user, businessName }: Props) => {
  const pathname = usePathname()
  const router = useRouter()
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
          {/* Single business: show it instead of the old multi-workspace entrypoint */}
          <Link
            href="/messages"
            className="flex max-w-[220px] items-center gap-2 rounded-xl border border-border bg-primary/10 px-4 py-2 text-sm text-primary hover:bg-primary/20"
          >
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">{businessName}</span>
          </Link>
          {/* Paid creators add offers and services here; everyone else sees the packages. */}
          {user.subscription ? <AddServiceDialog /> : <HeaderSubscription />}

        </div>
    </div>
  )
}

export default Header