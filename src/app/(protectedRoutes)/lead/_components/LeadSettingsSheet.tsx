'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { LeadConnectionSettings } from '@/lib/leads/leadConnectionSettings'
import { LeadApiSettings } from './LeadApiSettings'
import { LEAD_SETTINGS_EVENT } from './leadSettingsEvents'

/**
 * Lead settings (Fathom, Google Calendar, Serper) as a side panel on the Leads page.
 * Opens on the `sts-lead-settings` event, or when the page is opened with `?settings=1`
 * (the link from the Settings page).
 */
export function LeadSettingsSheet(props: LeadConnectionSettings) {
  const [open, setOpen] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(LEAD_SETTINGS_EVENT, onOpen)
    return () => window.removeEventListener(LEAD_SETTINGS_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (searchParams.get('settings') !== '1') return
    setOpen(true)
    const next = new URLSearchParams(searchParams.toString())
    next.delete('settings')
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false })
  }, [searchParams, router, pathname])

  const connected = [props.fathomOk, props.gcalOk && !props.gcalNeedsReconnect, props.serperConfigured].filter(Boolean)
    .length

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* Full width on phones; a roomy side panel from sm up. */}
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>Lead settings</SheetTitle>
          <SheetDescription>
            Connections that bring in meetings, calendar events and new leads. {connected} of 3 connected.
          </SheetDescription>
        </SheetHeader>
        <div className="p-4">
          <LeadApiSettings {...props} embedded />
        </div>
      </SheetContent>
    </Sheet>
  )
}
