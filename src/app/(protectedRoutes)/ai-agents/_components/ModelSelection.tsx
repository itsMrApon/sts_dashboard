'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { ArrowLeft, Settings } from 'lucide-react'
import React from 'react'
import type { AgentEngineView } from '@/actions/agentEngine'
import { useAiAgentStore } from '@/store/useAiAgentstore'
import ModelConfiguration from './ModelConfiguration'

type Props = { engineView: AgentEngineView | null }

/**
 * The agent editor. Phones: only shown once an agent is picked (list/detail), with a Back button
 * to the list. md+: always shown beside the list.
 */
const ModelSelection = ({ engineView }: Props) => {
  const { livekitAgent, assistant, clearAiAssistant, hasUnsavedChanges } = useAiAgentStore()
  const selected = Boolean(livekitAgent || assistant)

  const backToList = () => {
    if (hasUnsavedChanges && !window.confirm('You have unsaved changes in this agent. Discard them?')) return
    clearAiAssistant()
  }

  return (
    <div
      className={`${selected ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 sm:p-8 md:flex`}
    >
      <div className="mb-4 flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={backToList}
          className="text-muted-foreground hover:text-foreground -ml-1 mr-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm md:hidden"
        >
          <ArrowLeft className="h-4 w-4" /> Agents
        </button>
        <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs">
          <Settings />
        </span>
        <span className="text-sm font-medium uppercase">MODEL</span>
      </div>

      <ScrollArea className="min-h-0 flex-1 overflow-hidden">
        <ModelConfiguration engineView={engineView} />
      </ScrollArea>
    </div>
  )
}

export default ModelSelection
