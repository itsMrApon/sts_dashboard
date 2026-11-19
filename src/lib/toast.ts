'use client'

/**
 * The app's toasts, shown by the Sakuga toast (SakugaToaster in the root layout). Same calls as
 * before: toast.success / error / info / warning / dismiss, with optional description, action and
 * duration (ms). One toast shows at a time; a new one replaces it.
 */
export type ToastVariant = 'success' | 'error' | 'info' | 'warning'
export type ToastOptions = {
  id?: string
  description?: string
  /** Milliseconds on screen. */
  duration?: number
  action?: { label: string; onClick: () => void }
}
export type ToastMessage = { variant: ToastVariant; message: string; options: ToastOptions }

type Listener = (toast: ToastMessage | null) => void
const listeners = new Set<Listener>()
const waiting: ToastMessage[] = []

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener)
  while (waiting.length) listener(waiting.shift() ?? null)
  return () => {
    listeners.delete(listener)
  }
}

/** Raw codes some server actions return, said the way a person would. */
const PLAIN_ERRORS: Record<string, string> = {
  UNAUTHENTICATED: 'Your session ended. Sign in again to keep going.',
  FORBIDDEN: "You don't have access to that.",
  DATABASE_UNAVAILABLE: "We can't reach the database right now. Try again in a moment.",
}

/** A toast reads like a sentence: known codes become words, and " — " asides become a full stop. */
function plain(message: unknown): string {
  const text = String(message ?? '').trim()
  return PLAIN_ERRORS[text] ?? text.replace(/\s+—\s+/g, '. ')
}

function emit(variant: ToastVariant, message: unknown, options: ToastOptions = {}) {
  const item: ToastMessage = { variant, message: plain(message), options }
  if (listeners.size === 0) {
    waiting.push(item)
    return
  }
  for (const listener of listeners) listener(item)
}

export const toast = {
  success: (message: unknown, options?: ToastOptions) => emit('success', message, options),
  error: (message: unknown, options?: ToastOptions) => emit('error', message, options),
  info: (message: unknown, options?: ToastOptions) => emit('info', message, options),
  warning: (message: unknown, options?: ToastOptions) => emit('warning', message, options),
  dismiss: () => {
    for (const listener of listeners) listener(null)
  },
}
