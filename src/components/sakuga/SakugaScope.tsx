'use client'

import { createContext, useContext, type ReactNode } from 'react'

/**
 * Sakuga controls are for the app's own screens. Buyer-facing pages (share links, rooms, hosted
 * pages, forms) wrap themselves in <PlainControls>, and the shared Button, Switch, Input and
 * Tooltip render their plain versions there.
 */
const SakugaEnabled = createContext(true)

export function useSakugaEnabled(): boolean {
  return useContext(SakugaEnabled)
}

export function PlainControls({ children }: { children: ReactNode }) {
  return (
    <SakugaEnabled.Provider value={false}>
      {/* Marks the area for the global CSS (leading-icon rule) without adding a box. */}
      <div data-sakuga="off" className="contents">
        {children}
      </div>
    </SakugaEnabled.Provider>
  )
}

/** Paths of the buyer-facing pages (the public route group), for things that live outside it, like toasts. */
const PUBLIC_PREFIXES = ['/o/', '/pay/', '/live/', '/chat', '/speak/', '/form/', '/business/', '/wizard/']

export function isPublicSurface(pathname: string | null): boolean {
  if (!pathname) return false
  // /wizard/<slug>/configure is the creator's editor, not the public tour.
  if (pathname.startsWith('/wizard/') && pathname.endsWith('/configure')) return false
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix))
}
