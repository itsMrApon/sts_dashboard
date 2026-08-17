import React from 'react'
import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import ConfigProviderSidebar from '../_components/ConfigProviderSidebar'
import ConfigUsageDashboard from '../_components/ConfigUsageDashboard'

const ConfigAgentPage = () => {
  return (
    <PageViewport>
      <div className="flex h-full min-h-0 w-full overflow-hidden rounded-se-xl border border-border text-primary">
        <ConfigProviderSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
            <ConfigUsageDashboard />
          </div>
        </div>
      </div>
    </PageViewport>
  )
}

export default ConfigAgentPage
