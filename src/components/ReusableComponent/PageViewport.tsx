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

    // Phones (< md): reserve only the bottom tab bar (MobileNav, 56px) plus 8px, so panes reach
    // down to it. Desktop keeps `bottomPad` for the layout's py-10.
    const phone = window.matchMedia('(max-width: 767px)')
    const syncHeight = () => {
      const top = el.getBoundingClientRect().top
      const pad = phone.matches ? 64 : bottomPad
      el.style.height = `${Math.max(0, window.innerHeight - top - pad)}px`
    }

    syncHeight()
    window.addEventListener('resize', syncHeight)
    return () => window.removeEventListener('resize', syncHeight)
  }, [bottomPad])

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prev = {
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      bodyPosition: body.style.position,
      bodyInset: body.style.inset,
      bodyWidth: body.style.width,
    }
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    // No rubber-band bounce or pull-to-refresh dragging the page.
    html.style.overscrollBehavior = 'none'
    body.style.overscrollBehavior = 'none'
    // Phones: overflow: hidden does not stop a finger from scrolling the page in iOS Safari (the
    // layout's bottom padding for the tab bar makes it a little taller than the screen), so the
    // body is pinned in place. Panes inside still scroll.
    const phone = window.matchMedia('(max-width: 767px)')
    const pin = () => {
      if (phone.matches) {
        window.scrollTo(0, 0)
        body.style.position = 'fixed'
        body.style.inset = '0'
        body.style.width = '100%'
      } else {
        body.style.position = prev.bodyPosition
        body.style.inset = prev.bodyInset
        body.style.width = prev.bodyWidth
      }
    }
    pin()
    phone.addEventListener('change', pin)
    return () => {
      phone.removeEventListener('change', pin)
      html.style.overflow = prev.htmlOverflow
      html.style.overscrollBehavior = prev.htmlOverscroll
      body.style.overflow = prev.bodyOverflow
      body.style.overscrollBehavior = prev.bodyOverscroll
      body.style.position = prev.bodyPosition
      body.style.inset = prev.bodyInset
      body.style.width = prev.bodyWidth
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
