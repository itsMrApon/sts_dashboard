'use client'

import { useEffect } from 'react'
import { toast } from '@/lib/toast'
import {
  CONNECTION_LOST_MESSAGE,
  isDatabaseConnectivityError,
} from '@/lib/prismaErrors'

const IS_DEV = process.env.NODE_ENV === 'development'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isConnectivity =
    isDatabaseConnectivityError(error) || error.message === CONNECTION_LOST_MESSAGE

  useEffect(() => {
    if (isConnectivity) {
      toast.error(CONNECTION_LOST_MESSAGE, {
        id: 'connection-lost',
        duration: 6000,
      })
      return
    }
    // Avoid console.error(error) — Next.js surfaces Error objects as a red overlay.
    console.warn('[app/error]', error.message, error.digest ?? '')
  }, [error, isConnectivity])

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold">
        {isConnectivity ? 'Connection lost' : 'Something went wrong'}
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {isConnectivity
          ? CONNECTION_LOST_MESSAGE
          : // Raw messages (e.g. "Cannot read properties of undefined") help in dev only.
            IS_DEV && error.message
            ? error.message
            : 'An unexpected error occurred. Please try again.'}
      </p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Try again
      </button>
    </div>
  )
}
