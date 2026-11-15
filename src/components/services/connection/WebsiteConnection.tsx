'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, Globe2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { WebsiteConnection } from '@/lib/embed/websiteConnectionShared'
import { WebsiteKeyCard } from './WebsiteKeyCard'

type Gate = {
  connection: WebsiteConnection
  /** Runs `action` when a website is connected; otherwise asks to connect one first. */
  requireWebsite: (action: () => void) => void
}

const WebsiteConnectionContext = createContext<Gate | null>(null)

/** Outside /services (e.g. AI Agents) nothing goes live, so there is no gate. */
export function useWebsiteGate(): Gate['requireWebsite'] {
  const gate = useContext(WebsiteConnectionContext)
  return gate?.requireWebsite ?? ((action) => action())
}

export function WebsiteConnectionProvider({
  roomName,
  initial,
  children,
}: {
  roomName: string
  initial: WebsiteConnection
  children: ReactNode
}) {
  const [connection, setConnection] = useState(initial)
  const [open, setOpen] = useState(false)
  const pendingRef = useRef<(() => void) | null>(null)

  const requireWebsite = useCallback(
    (action: () => void) => {
      if (connection.connected) {
        action()
        return
      }
      pendingRef.current = action
      setOpen(true)
    },
    [connection.connected],
  )

  const value = useMemo(() => ({ connection, requireWebsite }), [connection, requireWebsite])

  const close = (next: boolean) => {
    setOpen(next)
    if (!next) pendingRef.current = null
  }

  const continuePublish = () => {
    const action = pendingRef.current
    pendingRef.current = null
    setOpen(false)
    action?.()
  }

  return (
    <WebsiteConnectionContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-primary" aria-hidden />
              Connect your website first
            </DialogTitle>
            <DialogDescription>Only needed once. Every service uses the same connection.</DialogDescription>
          </DialogHeader>
          <WebsiteKeyCard
            roomName={roomName}
            onConnected={(origin) => setConnection({ connected: true, origin })}
          />
          <div className="flex items-center justify-between gap-2 pt-1">
            <Link href="/services/connection" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
              Setup guide
            </Link>
            <Button size="sm" onClick={continuePublish} disabled={!connection.connected}>
              Continue
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </WebsiteConnectionContext.Provider>
  )
}
