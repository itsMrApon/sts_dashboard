'use client'

import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

/** @deprecated Prefer PageViewport — kept for lead route imports. */
export function LeadViewport({ children }: Props) {
  return <PageViewport>{children}</PageViewport>
}
