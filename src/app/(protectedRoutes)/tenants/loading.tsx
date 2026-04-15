export default function TenantsLoading() {
  return (
    <div className="w-full flex flex-col gap-8">
      <div className="flex w-full items-center justify-between gap-4">
        <div className="h-14 w-full max-w-md rounded-lg bg-muted animate-pulse" />
        <div className="flex gap-2">
          <div className="h-10 w-32 rounded-md bg-muted animate-pulse" />
          <div className="h-10 w-24 rounded-md bg-muted animate-pulse" />
        </div>
      </div>
      <div className="rounded-xl border border-border p-4">
        <div className="h-5 w-2/3 rounded bg-muted animate-pulse" />
        <div className="mt-3 h-4 w-full rounded bg-muted animate-pulse" />
        <div className="mt-2 h-4 w-3/4 rounded bg-muted animate-pulse" />
        <div className="mt-5 flex gap-2">
          <div className="h-8 w-20 rounded-md bg-muted animate-pulse" />
          <div className="h-8 w-20 rounded-md bg-muted animate-pulse" />
        </div>
      </div>
    </div>
  )
}
