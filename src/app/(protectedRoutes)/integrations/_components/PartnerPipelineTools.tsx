'use client'

import { ToolCallsSection } from '@/components/ui/tool-calls-section'
import { getPartnerPipelineTools } from '@/lib/partners/pipelinePrompts'

export function PartnerPipelineTools({ kind }: { kind: string }) {
  const tools = getPartnerPipelineTools(kind)
  if (tools.length === 0) return null

  return (
    <ToolCallsSection
      toolCalls={tools}
      defaultExpanded={false}
      className="min-w-0 max-w-full"
      summaryLabel={`${tools.length} pipeline prompt${tools.length > 1 ? 's' : ''}`}
    />
  )
}
