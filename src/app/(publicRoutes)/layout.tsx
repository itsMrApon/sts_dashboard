import React from 'react'
import { PlainControls } from '@/components/sakuga/SakugaScope'
import { PublicAnalytics } from '@/components/analytics/PublicAnalytics'

type Props = { children: React.ReactNode }

/** Buyer-facing pages: plain controls (Sakuga is only for the app's own screens). */
const layout = ({ children }: Props) => {
  return (
    <div className="w-full container mx-auto min-h-screen">
      <PublicAnalytics />
      <PlainControls>{children}</PlainControls>
    </div>
  )
}

export default layout
