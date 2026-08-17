import React, { Suspense } from 'react'
import { getAllAssistants } from '@/actions/vapi'
import { getLiveKitAgents } from '@/actions/livekitAgent'
import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import AiAgentSidebar from './_components/AiAgentSidebar'
import ModelSelection from './_components/ModelSelection'
import type { LiveKitUiAgentConfig } from '@/lib/livekit/livekitTypes'

async function AiAgentSidebarLoader({
  livekitAgents,
}: {
  livekitAgents: LiveKitUiAgentConfig[]
}) {
  const allAgents = await getAllAssistants()
  return (
    <AiAgentSidebar
      aiAgents={allAgents?.data || []}
      livekitAgents={livekitAgents}
    />
  )
}

const page = async () => {
  // LiveKit is DB-backed (cached). Stream shell with LiveKit first; Vapi fills via Suspense.
  const livekitResult = await getLiveKitAgents()
  const livekitAgents = livekitResult?.success ? livekitResult.data || [] : []

  return (
    <PageViewport>
      <div className="flex h-full min-h-0 w-full overflow-hidden rounded-se-xl border border-border text-primary">
        <Suspense
          fallback={
            <AiAgentSidebar aiAgents={[]} livekitAgents={livekitAgents} />
          }
        >
          <AiAgentSidebarLoader livekitAgents={livekitAgents} />
        </Suspense>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <ModelSelection />
        </div>
      </div>
    </PageViewport>
  )
}

export default page
