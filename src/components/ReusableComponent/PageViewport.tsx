'use client'

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** Extra bottom inset for protected layout `py-10` (default 40). */
  bottomPad?: number
  className?: string
  /**
   * When true, this container scrolls (content pages).
   * Default false: overflow hidden for nested panes (calendar, chat, sidebars).
   */
  scrollable?: boolean
}

/**
 * Fills remaining viewport under the app header / page chrome.
 * Locks document scroll so only nested panes (or this container) scroll.
 */
export function PageViewport({
  children,
  bottomPad = 40,
  className,
  scrollable = false,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const syncHeight = () => {
      const top = el.getBoundingClientRect().top
      el.style.height = `${Math.max(0, window.innerHeight - top - bottomPad)}px`
    }

    syncHeight()
    window.addEventListener('resize', syncHeight)
    return () => window.removeEventListener('resize', syncHeight)
  }, [bottomPad])

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtml = html.style.overflow
    const prevBody = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtml
      body.style.overflow = prevBody
    }
  }, [])

  return (
    <div
      ref={ref}
      className={
        className ??
        (scrollable
          ? 'min-h-0 w-full overflow-y-auto overscroll-contain'
          : 'flex min-h-0 w-full flex-col overflow-hidden')
      }
    >
      {children}
    </div>
  )
}
