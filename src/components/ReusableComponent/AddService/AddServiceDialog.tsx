'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ClipboardList,
  Loader2,
  MessageSquare,
  Mic,
  Package,
  PlusIcon,
  Video,
  Wand2,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createOffer } from '@/actions/offers'
import type { OfferKindInput } from '@/lib/offers/offerTypes'
import { guardAction } from '@/lib/clientActionErrors'

type Tile = { title: string; description: string; icon: LucideIcon }

const OFFERS: Array<Tile & { kind: OfferKindInput }> = [
  { kind: 'PRODUCT', title: 'Product', description: 'Sell a service or product with a share link', icon: Package },
  { kind: 'WEBINAR', title: 'Webinar', description: 'Go live, then drop your offer to attendees', icon: Video },
]

const WEBSITE_SERVICES: Array<Tile & { href: string }> = [
  { href: '/services/chat', title: 'Chat AI', description: 'Text chat on your website', icon: MessageSquare },
  { href: '/services/speak', title: 'Voice AI', description: 'Talk to your AI by voice', icon: Mic },
  { href: '/services/form', title: 'Form', description: 'Collect leads and callbacks', icon: ClipboardList },
  { href: '/services/wizard', title: 'Wizard', description: 'A voice guide through your site', icon: Wand2 },
]

const tileClass =
  'flex w-full items-start gap-3 rounded-xl border border-border bg-background p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5'

function TileBody({ tile }: { tile: Tile }) {
  const Icon = tile.icon
  return (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-sm font-medium">{tile.title}</span>
        <span className="block text-xs text-muted-foreground">{tile.description}</span>
      </span>
    </>
  )
}

/**
 * The one entry point for adding anything to the creator's business: offers (product, webinar)
 * are created here and open on their settings page; website services open their configurators.
 * Only rendered for creators with a package (the server re-checks on create).
 */
export default function AddServiceDialog({
  initialKind,
  triggerLabel = 'Add service',
}: {
  /** Open straight on the name step for this offer type (e.g. the Projects empty state). */
  initialKind?: OfferKindInput
  triggerLabel?: string
} = {}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [offerKind, setOfferKind] = useState<OfferKindInput | null>(initialKind ?? null)
  const [title, setTitle] = useState('')
  const [creating, startCreating] = useTransition()

  const reset = () => {
    setOfferKind(initialKind ?? null)
    setTitle('')
  }
  const backToPicker = () => {
    setOfferKind(null)
    setTitle('')
  }

  const create = () =>
    startCreating(guardAction(async () => {
      if (!offerKind) return
      const result = await createOffer({ kind: offerKind, title })
      if (!result.ok) return void toast.error(result.error)
      setOpen(false)
      reset()
      router.push(`/projects/${result.id}`)
    }))

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 rounded-xl border border-border bg-primary/10 px-4 py-2 text-sm font-normal text-primary backdrop-blur-sm hover:bg-primary/20">
          <PlusIcon className="h-4 w-4" />
          {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        {offerKind ? (
          <>
            <DialogHeader>
              <DialogTitle>New {offerKind === 'PRODUCT' ? 'product' : 'webinar'}</DialogTitle>
              <DialogDescription>Name it now. Price, ways to order and links come next.</DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                create()
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="new-offer-title">Name</Label>
                <Input
                  id="new-offer-title"
                  autoFocus
                  maxLength={255}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={offerKind === 'PRODUCT' ? 'e.g. Tax return review' : 'e.g. Medicare basics live'}
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={backToPicker} disabled={creating}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button type="submit" className="flex-1" disabled={creating || !title.trim()}>
                  {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create and set up
                </Button>
              </div>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add to your business</DialogTitle>
              <DialogDescription>Sell something, or add an AI service to your website.</DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sell</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {OFFERS.map((tile) => (
                    <button key={tile.kind} type="button" className={tileClass} onClick={() => setOfferKind(tile.kind)}>
                      <TileBody tile={tile} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Website services</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {WEBSITE_SERVICES.map((tile) => (
                    <Link key={tile.href} href={tile.href} className={tileClass} onClick={() => setOpen(false)}>
                      <TileBody tile={tile} />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
