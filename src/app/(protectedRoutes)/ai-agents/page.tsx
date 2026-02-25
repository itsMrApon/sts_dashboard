import React from 'react'
import { getAllAssistants } from '@/actions/vapi'
import AiAgentSidebar from './_components/AiAgentSidebar'
import ModelSelection from './_components/ModelSelection'

type Props = {}

const page = async (props: Props) => {
  const allAgents = await getAllAssistants()

  return (
    <div className="w-full flex h-[80vh] text-primary border border-border rounded-se-xl">
      <AiAgentSidebar aiAgents={allAgents?.data || []} />
      <div className="flex-1 flex flex-col min-w-0">
        <ModelSelection />
      </div>
    </div>
  )
}

export default page