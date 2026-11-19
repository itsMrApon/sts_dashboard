'use client'

import { useEffect, useRef } from 'react'
import { useSakuga } from './load'

type ProgressElement = HTMLElement & { set: (value: number) => void }

/**
 * Shown while the next page loads: the Sakuga progress bar with a storm cloud riding its edge. The
 * real wait has no percentage, so the bar fills quickly at first and slows near the end; the new page
 * replaces it as soon as it is ready.
 */
export function PageLoader({ label = 'Loading', fullScreen = false }: { label?: string; fullScreen?: boolean }) {
  useSakuga('progress')
  const ref = useRef<ProgressElement>(null)

  useEffect(() => {
    let value = 0.08
    let timer: ReturnType<typeof setInterval> | null = null
    customElements.whenDefined('sakuga-progress').then(() => {
      ref.current?.set(value)
      timer = setInterval(() => {
        value += (0.94 - value) * 0.07
        ref.current?.set(value)
      }, 120)
    })
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [])

  return (
    <div
      className={
        fullScreen
          ? 'flex min-h-screen w-full items-center justify-center p-6'
          : 'flex min-h-[60vh] w-full flex-1 items-center justify-center p-6'
      }
    >
      <sakuga-progress ref={ref} label={label} />
    </div>
  )
}
