'use client'

import React, { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import PurpleIcon from '../PurpleIcon'
import PackagesDialog from '../PlatformPackages/PackagesDialog'

/**
 * The STS logo for creators without a plan: tapping it pops up Subscribe, which opens the plans.
 * Replaces the separate "+ Subscribe" button, so the header stays STS · Messages for everyone.
 */
export default function HeaderSubscription({ children }: { children: React.ReactNode }) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [plansOpen, setPlansOpen] = useState(false)

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="STS plans: subscribe"
            className="relative flex rounded-md transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <PurpleIcon className="flex">{children}</PurpleIcon>
            {/* A small dot says there is something to do here. */}
            <span aria-hidden className="absolute -top-1 -right-1 size-2.5 rounded-full bg-primary ring-2 ring-background" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={10} className="w-64">
          <div className="flex flex-col gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">You&apos;re on the free plan</p>
              <p className="text-xs text-muted-foreground">
                Your own Gemini key runs everything for free. A plan adds the stronger AI keys and the add-on modules.
              </p>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                setPopoverOpen(false)
                setPlansOpen(true)
              }}
            >
              <Sparkles className="h-4 w-4" />
              Subscribe
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <PackagesDialog open={plansOpen} onOpenChange={setPlansOpen} />
    </>
  )
}
