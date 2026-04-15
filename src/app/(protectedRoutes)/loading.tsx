export default function ProtectedLoading() {
  return (
    <div className="flex w-full min-h-screen">
      <div className="w-18 sm:w-28 h-screen sticky top-0 py-10 px-2 sm:px-6 border border-border bg-background animate-pulse rounded-r-lg" />
      <div className="flex flex-col flex-1 items-center justify-center p-8">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground mt-3">Loading…</p>
      </div>
    </div>
  )
}
