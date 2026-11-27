'use client'

import React, { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { getPackageCards, type PackageCard } from '@/actions/platformBilling'
import PackagesPanel from './PackagesPanel'

type Props = {
  /** Controlled mode: something else (the STS logo's popover) opens the plans. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/** The plan picker for creators without a plan. Loads package prices only when opened. */
export default function PackagesDialog({ open: controlledOpen, onOpenChange }: Props = {}) {
  const [ownOpen, setOwnOpen] = useState(false)
  const controlled = controlledOpen !== undefined
  const open = controlled ? controlledOpen : ownOpen
  const setOpen = (next: boolean) => {
    if (!controlled) setOwnOpen(next)
    onOpenChange?.(next)
  }
  const [cards, setCards] = useState<PackageCard[] | null>(null)

  useEffect(() => {
    if (!open || cards) return
    let active = true
    getPackageCards()
      .then((result) => {
        if (active) setCards(result)
      })
      .catch(() => {
        if (active) setCards([])
      })
    return () => {
      active = false
    }
  }, [open, cards])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlled ? null : (
        <DialogTrigger asChild>
          <Button>+ Subscribe</Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[920px]">
        {/* The plan picker has its own visible heading; this one is for screen readers. */}
        <DialogHeader className="sr-only">
          <DialogTitle>Choose your plan</DialogTitle>
          <DialogDescription>
            Six plans, all starting with Launchpad. Pick a plan or switch on the add-on modules you need.
          </DialogDescription>
        </DialogHeader>
        {cards === null ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">Packages could not be loaded. Please try again.</p>
        ) : (
          <PackagesPanel cards={cards} onPurchased={() => setOpen(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}
