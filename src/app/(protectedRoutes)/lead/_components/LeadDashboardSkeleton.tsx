export function LeadDashboardSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="flex gap-2">
          <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
          <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-8 gap-px bg-border">
        <div className="bg-card" />
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 bg-card p-2">
            <div className="h-4 w-12 animate-pulse rounded bg-muted" />
            <div className="mt-6 h-16 w-full animate-pulse rounded-md bg-muted" />
            <div className="h-10 w-3/4 animate-pulse rounded-md bg-muted" />
            <div className="mt-auto h-8 w-full animate-pulse rounded-md bg-muted/70" />
          </div>
        ))}
      </div>
    </div>
  )
}
