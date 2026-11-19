'use client'

import { useEffect, useRef } from 'react'
import { subscribeToasts, type ToastMessage } from '@/lib/toast'
import { loadSakuga } from './load'

type ToastElement = HTMLElement & {
  show: (text: string, options?: { description?: string; action?: string; variant?: string; duration?: number }) => void
  hide: () => void
}

/** The one place toasts appear: the Sakuga toast, fixed at the bottom left (it streaks in from the left). */
export function SakugaToaster() {
  const ref = useRef<ToastElement>(null)
  const actionRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    let unsubscribe = () => {}
    let cancelled = false
    const onAction = () => actionRef.current?.()
    const element = ref.current
    element?.addEventListener('sakuga:action', onAction)
    loadSakuga('toast')
      .then(() => customElements.whenDefined('sakuga-toast'))
      .then(() => {
        if (cancelled) return
        unsubscribe = subscribeToasts((item: ToastMessage | null) => {
          const toast = ref.current
          if (!toast) return
          if (!item) {
            toast.hide()
            return
          }
          actionRef.current = item.options.action?.onClick ?? null
          toast.show(item.message, {
            description: item.options.description,
            action: item.options.action?.label,
            variant: item.variant === 'error' || item.variant === 'warning' ? 'error' : undefined,
            duration: item.options.duration ? item.options.duration / 1000 : undefined,
          })
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
      unsubscribe()
      element?.removeEventListener('sakuga:action', onAction)
    }
  }, [])

  return <sakuga-toast ref={ref} className="fixed bottom-20 left-4 z-[100] md:bottom-6 md:left-6" />
}
