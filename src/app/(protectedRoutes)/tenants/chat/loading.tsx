import { PageViewport } from '@/components/ReusableComponent/PageViewport'

export default function TenantChatLoading() {
  return (
    <PageViewport>
      <div className="text-muted-foreground flex h-full min-h-0 items-center justify-center text-sm">
        Loading partner assistant…
      </div>
    </PageViewport>
  )
}
