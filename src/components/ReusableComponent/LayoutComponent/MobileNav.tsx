'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { sidebarData } from '@/lib/data'
import { cn } from '@/lib/utils'

/**
 * Phone navigation: a bottom tab bar in place of the side rail (which would take a fifth of a
 * 375px screen). Shown below `md`; the Sidebar takes over from `md` up.
 */
export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex h-14 max-w-lg items-center justify-around px-1">
        {sidebarData.map((item) => {
          const active = pathname.startsWith(item.link)
          return (
            <li key={item.id}>
              <Link
                href={item.link}
                aria-label={item.title}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
                  active ? 'iconBackground text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <item.icon className="h-5 w-5" />
              </Link>
            </li>
          )
        })}
        <li className="flex h-11 w-11 items-center justify-center">
          <UserButton />
        </li>
      </ul>
    </nav>
  )
}
