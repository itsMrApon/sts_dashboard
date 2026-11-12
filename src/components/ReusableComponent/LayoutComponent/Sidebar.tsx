'use client'
import React from 'react'
import STS from '@/icons/sts'
import { usePathname } from 'next/navigation'
import { sidebarData } from '@/lib/data'
import { Tooltip, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { TooltipContent } from '@radix-ui/react-tooltip'
type Props = {}

const Sidebar = (props: Props) => {
  const pathname = usePathname()
  return (
    // Side rail from md up; phones use MobileNav (bottom tab bar).
    <div className="hidden md:flex w-28 h-screen sticky top-0 shrink-0 py-10 px-6 border bg-background border-border flex-col items-center justify-start gap-10">
      <div className='text-foreground'>
        <STS className="" />
      </div>
      <div className="w-full h-full justify-between items-center flex flex-col">
      {/* more icons */}
        <div className="w-full h-fit flex flex-col gap-4 items-center justify-center">
        {sidebarData.map ((item) => (
        <TooltipProvider key={item.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link 
              href={item.link}
              className={`flex items-center gap-2 cursor-pointer rounded-lg p-2 ${pathname.includes(item.link) ? 'iconBackground' : ''}`}
              >
                <item.icon
                className={`w-4 h-4 ${pathname.includes(item.link) ? '' : "opacity-80"}`}
                 />
              </Link>
            </TooltipTrigger>
            < TooltipContent side="right" >
              <span className="text-sm">{item.title}</span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
          ))}
        </div>
        <UserButton />
      </div>
    </div>

  )
}

export default Sidebar