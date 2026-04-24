'use client'

import React, { useMemo, useState } from 'react'
import { Webinar } from '@prisma/client'
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
import { Check, Copy, ExternalLink, MessageCircle } from 'lucide-react'
import { buildVariantLinks, DEFAULT_VARIANT, isWebinarLinkVariant, sanitizeVariants, WebinarLinkVariant } from '@/lib/webinarLinkVariants'

type Props = {
  project: Webinar
}

const getProjectVariants = (project: Webinar): WebinarLinkVariant[] => {
  const rawVariants = ((project as Webinar & { linkVariants?: string[] }).linkVariants || []).filter(
    isWebinarLinkVariant,
  )

  if (rawVariants.length) return sanitizeVariants(rawVariants)

  if (project.kind === 'PRODUCT' && project.ctaType === 'BUY_NOW') return ['PRODUCT_BUY_NOW']
  if (project.kind === 'PRODUCT' && project.ctaType === 'BOOK_A_CALL') return ['PRODUCT_BOOK_A_CALL']
  if (project.kind === 'PROJECT' && project.ctaType === 'BUY_NOW') return ['PROJECT_BUY_NOW']
  return [DEFAULT_VARIANT]
}

export default function ProjectLinksSheet({ project }: Props) {
  const [copied, setCopied] = useState<string | null>(null)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''

  const links = useMemo(() => {
    const variants = getProjectVariants(project)
    return buildVariantLinks(project.id, variants, baseUrl)
  }, [project, baseUrl])

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopied(url)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-md hover:bg-secondary"
          aria-label="Open share links"
        >
          <MessageCircle className="h-5 w-5" />
        </Button>
      </DrawerTrigger>

      <DrawerContent>
        <div className="mx-auto w-full max-w-2xl">
          <DrawerHeader>
            <DrawerTitle>Share Links</DrawerTitle>
            <DrawerDescription>{project.title}</DrawerDescription>
          </DrawerHeader>

          <div className="max-h-[60vh] overflow-y-auto px-4 pb-2 space-y-3">
          {links.map((item) => (
            <div key={item.url} className="rounded-xl border border-border bg-background/50 p-3">
              <p className="text-xs text-muted-foreground mb-2">{item.label}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  value={item.url}
                  readOnly
                  className="h-9 min-w-[220px] flex-1 rounded-md border border-input bg-background px-3 text-sm"
                />
                <Button variant="outline" size="icon" onClick={() => handleCopy(item.url)} aria-label={`Copy ${item.label}`}>
                  {copied === item.url ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <a href={item.url} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm" className="gap-1">
                    <ExternalLink className="h-4 w-4" />
                    Open
                  </Button>
                </a>
              </div>
            </div>
          ))}
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

