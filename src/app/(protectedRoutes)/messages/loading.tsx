export default function MessagesLoading() {
  return (
    <div className="w-full flex flex-col gap-8">
      <div className="flex w-full items-center justify-between gap-4">
        <div className="h-14 w-full max-w-md rounded-lg bg-muted animate-pulse" />
        <div className="h-10 w-28 rounded-md bg-muted animate-pulse" />
      </div>
      <div className="rounded-2xl border border-border p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 w-full">
            <div className="h-5 w-1/3 rounded bg-muted animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
        </div>
        <div className="mt-4 flex gap-3">
          <div className="h-6 w-24 rounded-full bg-muted animate-pulse" />
          <div className="h-6 w-24 rounded-full bg-muted animate-pulse" />
          <div className="h-6 w-24 rounded-full bg-muted animate-pulse" />
        </div>
        <div className="mt-4 flex gap-2">
          <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
          <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
          <div className="h-5 w-14 rounded-full bg-muted animate-pulse" />
        </div>
        <div className="mt-5 h-4 w-24 ml-auto rounded bg-muted animate-pulse" />
      </div>
    </div>
  )
}
