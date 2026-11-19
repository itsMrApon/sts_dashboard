import { unstable_rethrow } from 'next/navigation'
import { toast } from '@/lib/toast'
import { CONNECTION_LOST_MESSAGE, isDatabaseConnectivityError } from '@/lib/prismaErrors'

/** Turns an unexpected throw from a server action / fetch into a message a user can act on. */
export function describeActionError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const message = error instanceof Error ? error.message : ''
  // After a deploy, an open tab still holds the old action IDs until it reloads.
  if (/failed to find server action/i.test(message)) return 'The app was just updated. Refresh the page and try again.'
  if (isDatabaseConnectivityError(error) || /failed to fetch|load failed|networkerror/i.test(message)) {
    return CONNECTION_LOST_MESSAGE
  }
  return fallback
}

/**
 * Wraps the async body of a `startTransition` so an unexpected throw shows a toast.
 * In React 19 a rejected transition action is rethrown to the nearest error boundary,
 * which would replace the whole editor (and unsaved changes) with the error page.
 * Expected failures should still come back as `{ ok: false, error }` results.
 */
export function guardAction(action: () => Promise<void>, fallback?: string): () => Promise<void> {
  return async () => {
    try {
      await action()
    } catch (error) {
      // A server action's redirect()/notFound() rejects here on purpose; let Next handle it.
      unstable_rethrow(error)
      console.warn('[action] unexpected failure:', error instanceof Error ? error.message : error)
      toast.error(describeActionError(error, fallback), { id: 'action-error' })
    }
  }
}
