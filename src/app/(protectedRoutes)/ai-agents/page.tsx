import React from 'react'
import { getAllAssistants } from '@/actions/vapi'
import { getLiveKitAgents } from '@/actions/livekitAgent'
import AiAgentSidebar from './_components/AiAgentSidebar'
import ModelSelection from './_components/ModelSelection'

type Props = {}

const page = async (props: Props) => {
  const [allAgents, livekitResult] = await Promise.all([
    getAllAssistants(),
    getLiveKitAgents(),
  ])

  const livekitAgents = livekitResult?.success ? (livekitResult.data || []) : []

  return (
    <div className="w-full flex h-[calc(100dvh-8rem)] min-h-[520px] text-primary border border-border rounded-se-xl">
      <AiAgentSidebar
        aiAgents={allAgents?.data || []}
        livekitAgents={livekitAgents}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <ModelSelection />
      </div>
    </div>
  )
}

export default page