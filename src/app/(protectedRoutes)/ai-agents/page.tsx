import React, { Suspense } from 'react'
import { getAllAssistants } from '@/actions/vapi'
import { getLiveKitAgents } from '@/actions/livekitAgent'
import { getAgentEngineSettings } from '@/actions/agentEngine'
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
  const [livekitResult, engineResult] = await Promise.all([getLiveKitAgents(), getAgentEngineSettings()])
  const livekitAgents = livekitResult?.success ? livekitResult.data || [] : []
  const engineView = engineResult.ok
    ? { engine: engineResult.engine, source: engineResult.source, voiceLabel: engineResult.voiceLabel }
    : null

  return (
    <PageViewport>
      {/* Phones: agent list on top (capped height), editor below. md+: side by side. */}
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-se-xl border border-border text-primary md:flex-row">
        <Suspense
          fallback={
            <AiAgentSidebar aiAgents={[]} livekitAgents={livekitAgents} />
          }
        >
          <AiAgentSidebarLoader livekitAgents={livekitAgents} />
        </Suspense>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <ModelSelection engineView={engineView} />
        </div>
      </div>
    </PageViewport>
  )
}

export default page
