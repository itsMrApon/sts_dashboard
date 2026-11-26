'use client'

/**
 * Curved slide-in panel, adapted from the "curved-menu" component: a sheet that slides in from the
 * right with a curved leading edge that straightens as it lands. The original full-screen nav
 * (white, big numbered links, social footer) is reduced to the panel itself, themed with the app's
 * colours, so any content can live inside (Messages uses it). Uses `motion` (framer-motion's
 * current package name, already a dependency).
 */

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type CSSProperties, type ReactNode, type Ref, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

const EASE = [0.76, 0, 0.24, 1] as const

const SLIDE = {
  initial: { x: 'calc(100% + 100px)' },
  enter: { x: '0', transition: { duration: 0.8, ease: EASE } },
  exit: { x: 'calc(100% + 100px)', transition: { duration: 0.8, ease: EASE } },
}

/** The curved leading edge: bulges out while sliding in, flat once open. */
function Curve() {
  const [height] = useState(() => (typeof window === 'undefined' ? 800 : window.innerHeight))
  const initialPath = `M100 0 L200 0 L200 ${height} L100 ${height} Q-100 ${height / 2} 100 0`
  const targetPath = `M100 0 L200 0 L200 ${height} L100 ${height} Q100 ${height / 2} 100 0`
  const curve = {
    initial: { d: initialPath },
    enter: { d: targetPath, transition: { duration: 1, ease: EASE } },
    exit: { d: initialPath, transition: { duration: 0.8, ease: EASE } },
  }
  return (
    <svg aria-hidden className="pointer-events-none absolute top-0 -left-[99px] h-full w-[100px] stroke-none" style={{ fill: 'var(--background)' }}>
      <motion.path variants={curve} initial="initial" animate="enter" exit="exit" />
    </svg>
  )
}

/** The original 3-line toggle: a white square with three black bars that turn into an X. */
export function MenuToggle({
  active,
  onClick,
  label,
  className,
  style,
  ref,
}: {
  active: boolean
  onClick: () => void
  label: string
  className?: string
  style?: CSSProperties
  ref?: Ref<HTMLButtonElement>
}) {
  return (
    <button
      ref={ref}
      style={style}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={active}
      className={cn('z-50 flex size-8 cursor-pointer items-center justify-center rounded-none bg-white', className)}
    >
      <span className="relative flex h-3 w-4 flex-col items-center justify-between">
        <span className={cn('block h-0.5 w-4 bg-black transition-transform duration-300', active && 'translate-y-[5px] rotate-45')} />
        <span className={cn('block h-0.5 w-4 bg-black transition-opacity duration-300', active && 'opacity-0')} />
        <span className={cn('block h-0.5 w-4 bg-black transition-transform duration-300', active && '-translate-y-[5px] -rotate-45')} />
      </span>
    </button>
  )
}

export function CurvedPanel({
  open,
  onClose,
  title,
  children,
  className,
  anchor,
}: {
  open: boolean
  onClose: () => void
  /** Accessible name of the panel. */
  title: string
  children: ReactNode
  className?: string
  /**
   * The button that opened the panel. The panel's X lands exactly on it, and the content starts
   * below it, so the toggle looks like one button that turned into an X.
   */
  anchor?: RefObject<HTMLElement | null>
}) {
  // Rendered into <body> so it sits above everything, not inside the caller's stacking context
  // (the header is a sticky z-30 layer; the bottom nav would otherwise draw over the panel).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [spot, setSpot] = useState<{ top: number; right: number; contentTop: number } | null>(null)

  // Escape closes; the page behind does not scroll while the panel is open.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onClose()
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Measured after the scroll lock, which can remove the scrollbar and shift the header.
    const measure = () => {
      const rect = anchor?.current?.getBoundingClientRect()
      if (!rect || !rect.width) return setSpot(null)
      setSpot({
        top: rect.top,
        right: document.documentElement.clientWidth - rect.right,
        contentTop: rect.bottom + 16,
      })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', measure)
      document.body.style.overflow = overflow
    }
  }, [open, onClose, anchor])

  if (!mounted) return null
  return createPortal(
    <AnimatePresence mode="wait">
      {open ? (
        <>
          <motion.div
            key="backdrop"
            aria-hidden
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.4 } }}
            exit={{ opacity: 0, transition: { duration: 0.6, delay: 0.2 } }}
          />
          <motion.div
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            variants={SLIDE}
            initial="initial"
            animate="enter"
            exit="exit"
            className={cn('bg-background fixed top-0 right-0 z-50 flex h-[100dvh] w-screen flex-col', className)}
          >
            <MenuToggle
              active
              onClick={onClose}
              label={`Close ${title}`}
              className="absolute"
              style={spot ? { top: spot.top, right: spot.right } : { top: 8, right: 8 }}
            />
            {/* --panel-top: where content may start below the X. The content pads with it itself,
                so each column can fill that space in its own colour. */}
            <div
              className="flex min-h-0 flex-1 flex-col"
              style={{ '--panel-top': `${spot ? spot.contentTop : 48}px` } as CSSProperties}
            >
              {children}
            </div>
            <Curve />
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

export default CurvedPanel
