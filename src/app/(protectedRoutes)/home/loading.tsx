export default function HomeLoading() {
  return (
    <div className="w-full flex flex-col gap-8">
      <div className="h-12 w-2/3 rounded-lg bg-muted animate-pulse" />
      <div className="h-72 rounded-xl bg-muted animate-pulse" />
    </div>
  )
}
