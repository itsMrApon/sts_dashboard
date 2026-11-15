'use client'

// global-error replaces the root layout, so the app stylesheet must be loaded here too.
import './globals.css'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-foreground">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="max-w-md text-center text-sm text-muted-foreground">
          {process.env.NODE_ENV === 'development' && error.message
            ? error.message
            : 'A critical error occurred. Please try again.'}
        </p>
        {error.digest ? <p className="text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Try again
        </button>
      </body>
    </html>
  )
}
