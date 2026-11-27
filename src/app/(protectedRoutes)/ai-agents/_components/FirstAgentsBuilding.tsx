'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { getFirstAgentStatus } from '@/actions/onboarding'

const CHECK_EVERY_MS = 3000

/**
 * Shown on AI Agents while the assistants picked in setup are still being written (they build in
 * the background, one per service, and can land a minute after setup ends). Checks the build and
 * refreshes the list once it is done, so no assistant seems to be missing.
 */
export function FirstAgentsBuilding({ labels }: { labels: string[] }) {
  const router = useRouter()
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (done) return
    let cancelled = false
    const timer = window.setInterval(async () => {
      const status = await getFirstAgentStatus().catch(() => null)
      if (cancelled || status?.status === 'building') return
      setDone(true)
      router.refresh()
    }, CHECK_EVERY_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [done, router])

  if (done) return null
  return (
    <p role="status" className="mb-2 flex shrink-0 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      Still building your {joinNames(labels)}. They&apos;ll appear here in a moment.
    </p>
  )
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? 'assistants'
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}
