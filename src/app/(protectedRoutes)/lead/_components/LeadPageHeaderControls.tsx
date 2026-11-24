'use client'

import Link from 'next/link'
import { Settings2 } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { SakugaTabs } from '@/components/sakuga/SakugaTabs'
import { cn } from '@/lib/utils'

/** The Lead sections, each at /lead/<section>. /lead itself is the hub. */
export const LEAD_SECTIONS = [
  { value: 'intel', label: 'Intel' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'list', label: 'List' },
  { value: 'video', label: 'Video' },
  { value: 'diagram', label: 'Diagram' },
] as const

export type LeadSection = (typeof LEAD_SECTIONS)[number]['value']
export type LeadViewMode = Extract<LeadSection, 'calendar' | 'list'>

function sectionFromPath(pathname: string): LeadSection {
  const segment = pathname.split('/')[2]
  return LEAD_SECTIONS.find((section) => section.value === segment)?.value ?? 'calendar'
}

/** Section tabs (they change the URL) and a way to the lead connections on /integrations. */
export function LeadPageHeaderControls({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const current = sectionFromPath(pathname)

  return (
    <div className="flex items-center gap-1.5">
      <SakugaTabs
        label="Lead sections"
        value={current}
        onChange={(next) => {
          if (next !== current) router.push(`/lead/${next}`)
        }}
        options={LEAD_SECTIONS.map(({ value, label }) => ({ value, label }))}
        className={compact ? '!mt-1 [zoom:0.7]' : '!mt-1'}
      />
      <Link
        href="/integrations"
        aria-label="Lead connections in Integrations"
        title="Fathom, Google OAuth and Serper live in Integrations"
        className={cn(
          'text-muted-foreground hover:text-foreground inline-flex items-center justify-center rounded-lg border transition-colors hover:bg-muted/50',
          compact ? 'h-8 w-8' : 'h-10 w-10',
        )}
      >
        <Settings2 className="size-4" />
      </Link>
    </div>
  )
}
