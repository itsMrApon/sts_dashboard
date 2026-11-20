'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { toast as sonner } from 'sonner'
import { Toaster as PlainToaster } from '@/components/ui/sonner'
import { subscribeToasts, type ToastMessage } from '@/lib/toast'
import { loadSakuga } from './load'
import { isPublicSurface } from './SakugaScope'

type ToastElement = HTMLElement & {
  show: (text: string, options?: { description?: string; action?: string; variant?: string; duration?: number }) => void
  hide: () => void
}

/** Buyer-facing pages: the same toast calls, shown by the plain toaster. */
function PublicToaster() {
  useEffect(
    () =>
      subscribeToasts((item) => {
        if (!item) return void sonner.dismiss()
        const { description, duration, action, id } = item.options
        sonner[item.variant](item.message, { description, duration, id, action })
      }),
    [],
  )
  return <PlainToaster position="top-center" richColors closeButton />
}

/** The one place toasts appear: in the app, the Sakuga toast; on buyer-facing pages, the plain one. */
export function SakugaToaster() {
  return isPublicSurface(usePathname()) ? <PublicToaster /> : <AppToaster />
}

/** The Sakuga toast, fixed at the bottom left (it streaks in from the left). */
function AppToaster() {
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
