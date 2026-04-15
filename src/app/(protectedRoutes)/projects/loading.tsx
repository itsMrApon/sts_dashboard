export default function ProjectsLoading() {
  return (
    <div className="w-full flex flex-col gap-8">
      <div className="h-14 w-full max-w-md rounded-lg bg-muted animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col gap-3 w-full">
            <div className="w-full max-w-[400px] h-[100px] rounded-md bg-muted animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
