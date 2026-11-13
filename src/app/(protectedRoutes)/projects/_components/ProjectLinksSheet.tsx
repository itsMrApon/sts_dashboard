'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { Check, Copy, CreditCard, ExternalLink, MessageCircle, Radio, Sparkles } from 'lucide-react'
import { buildOfferShareLinks, type OfferShareLink } from '@/lib/offers/offerLinks'
import type { OrderModeKey } from '@/lib/offers/offerTypes'

type Props = {
  project: {
    id: string
    title: string
    slug: string | null
    orderModes?: { kind: OrderModeKey; enabled: boolean }[]
  }
  /** From the server: the address buyers can open (your network address in development). */
  shareBaseUrl: string
}

const LINK_ICON: Record<OfferShareLink['variant'], React.ReactNode> = {
  share: <Sparkles className="h-4 w-4" />,
  pay: <CreditCard className="h-4 w-4" />,
  live: <Radio className="h-4 w-4" />,
}

/** The offer's public links (share, direct pay, live), built from its ways to order. */
export default function ProjectLinksSheet({ project, shareBaseUrl }: Props) {
  const [copied, setCopied] = useState<string | null>(null)

  const links = useMemo(() => {
    const modes = Object.fromEntries((project.orderModes ?? []).map((mode) => [mode.kind, mode.enabled]))
    return buildOfferShareLinks(project.slug, modes, shareBaseUrl)
  }, [project.slug, project.orderModes, shareBaseUrl])

  const handleCopy = (url: string) => {
    void navigator.clipboard.writeText(url)
    setCopied(url)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-md hover:bg-secondary" aria-label="Open share links">
          <MessageCircle className="h-5 w-5" />
        </Button>
      </DrawerTrigger>

      <DrawerContent>
        <div className="mx-auto w-full max-w-2xl">
          <DrawerHeader>
            <DrawerTitle>Share links</DrawerTitle>
            <DrawerDescription>{project.title}</DrawerDescription>
          </DrawerHeader>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto px-4 pb-2">
            {links.length ? (
              links.map((item) => (
                <div key={item.variant} className="rounded-xl border border-border bg-background/50 p-3">
                  <div className="mb-2 flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-primary">{LINK_ICON[item.variant]}</span>
                    <p className="shrink-0 whitespace-nowrap text-sm font-medium">{item.label}</p>
                    <p className="min-w-0 truncate text-xs text-muted-foreground">· {item.hint}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={item.url}
                      readOnly
                      onFocus={(event) => event.target.select()}
                      className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                    />
                    <Button variant="outline" size="icon" className="shrink-0" onClick={() => handleCopy(item.url)} aria-label={`Copy ${item.label}`}>
                      {copied === item.url ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="icon" className="shrink-0" asChild>
                      <a href={item.url} target="_blank" rel="noreferrer" aria-label={`Open ${item.label}`}>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No links yet. Turn on a way to order in{' '}
                <Link href={`/projects/${project.id}`} className="underline underline-offset-2">
                  offer settings
                </Link>
                .
              </p>
            )}
          </div>

          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Close</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
