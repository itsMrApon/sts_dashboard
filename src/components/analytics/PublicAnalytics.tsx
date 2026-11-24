'use client'

import { useEffect } from 'react'
import { startAnalytics } from '@/lib/analytics/track'

/** Starts visitor analytics on the public pages when a PostHog key is configured. */
export function PublicAnalytics() {
  useEffect(() => {
    startAnalytics()
  }, [])
  return null
}
