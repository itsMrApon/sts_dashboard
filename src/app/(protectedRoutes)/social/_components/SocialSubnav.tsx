'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const SECTIONS: { href: string; label: string; exact?: boolean }[] = [
  { href: '/social', label: 'All channels', exact: true },
  { href: '/social/instagram', label: 'Instagram' },
  { href: '/social/whatsapp', label: 'WhatsApp' },
]

export function SocialSubnav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Social sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {SECTIONS.map((section) => {
        const active = section.exact ? pathname === section.href : pathname.startsWith(section.href)
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors',
              active ? 'bg-primary/15 font-medium text-primary' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            {section.label}
          </Link>
        )
      })}
    </nav>
  )
}
