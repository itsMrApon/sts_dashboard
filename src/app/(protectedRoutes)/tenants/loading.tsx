import { PageViewport } from '@/components/ReusableComponent/PageViewport'

export default function TenantsLoading() {
  return (
    <PageViewport scrollable>
      <section>
        <div className="py-8 md:py-16">
          <div className="mx-auto max-w-5xl px-2 sm:px-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="h-10 w-full max-w-md animate-pulse rounded-lg bg-muted/70" />
              <div className="h-5 w-full max-w-lg animate-pulse rounded bg-muted/70" />
            </div>
            <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="rounded-xl border border-border p-6">
                  <div className="size-10 animate-pulse rounded-md bg-muted/70" />
                  <div className="mt-6 h-4 w-1/2 animate-pulse rounded bg-muted/70" />
                  <div className="mt-3 h-4 w-full animate-pulse rounded bg-muted/70" />
                  <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-muted/70" />
                  <div className="mt-6 border-t border-dashed pt-6">
                    <div className="h-8 w-24 animate-pulse rounded-md bg-muted/70" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </PageViewport>
  )
}
