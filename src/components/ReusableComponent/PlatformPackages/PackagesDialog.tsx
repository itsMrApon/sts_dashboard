'use client'

import React, { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
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

/** Header entry point for creators without access. Loads package prices only when opened. */
export default function PackagesDialog() {
  const [open, setOpen] = useState(false)
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
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 rounded-xl border border-border bg-primary/10 px-4 py-2 text-sm font-normal text-primary backdrop-blur-sm hover:bg-primary/20">
          + Subscribe
        </button>
      </DialogTrigger>
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
