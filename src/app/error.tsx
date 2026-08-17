'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import {
  CONNECTION_LOST_MESSAGE,
  isDatabaseConnectivityError,
} from '@/lib/prismaErrors'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isConnectivity = isDatabaseConnectivityError(error)

  useEffect(() => {
    if (isConnectivity) {
      toast.error(CONNECTION_LOST_MESSAGE, {
        id: 'connection-lost',
        duration: 6000,
      })
      return
    }
    // Avoid console.error(error) — Next.js surfaces Error objects as a red overlay.
    console.warn('[app/error]', error.message)
  }, [error, isConnectivity])

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold">
        {isConnectivity ? 'Connection lost' : 'Something went wrong'}
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {isConnectivity
          ? CONNECTION_LOST_MESSAGE
          : error.message || 'An unexpected error occurred.'}
      </p>
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
