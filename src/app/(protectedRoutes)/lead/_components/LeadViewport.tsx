'use client'

import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

/** @deprecated Prefer PageViewport — kept for lead route imports. */
export function LeadViewport({ children }: Props) {
  // 16px under the box on desktop (default 40 left a dark band below the list).
  return <PageViewport bottomPad={16}>{children}</PageViewport>
}
