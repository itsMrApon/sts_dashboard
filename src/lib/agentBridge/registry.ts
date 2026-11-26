import 'server-only'
import { BRAIN_TOOLS } from './areas/brain'
import { INTEGRATION_TOOLS } from './areas/integrations'
import { KNOWLEDGE_TOOLS } from './areas/knowledge'
import { LEAD_TOOLS } from './areas/leads'
import { MESSAGE_TOOLS } from './areas/messages'
import { REQUEST_TOOLS } from './areas/requests'
import { SERVICE_TOOLS } from './areas/services'
import { SOCIAL_TOOLS } from './areas/social'
import type { AgentTool } from './types'

/**
 * Every tool the creator's agent can use, by area. A new page plugs in by adding its file under
 * ./areas (read tools answer at once; write tools go through Lead → Approval) and listing it here.
 */
export const AGENT_TOOLS: AgentTool[] = [
  ...BRAIN_TOOLS,
  ...KNOWLEDGE_TOOLS,
  ...INTEGRATION_TOOLS,
  ...LEAD_TOOLS,
  ...MESSAGE_TOOLS,
  ...SOCIAL_TOOLS,
  ...SERVICE_TOOLS,
  ...REQUEST_TOOLS,
]

const BY_NAME = new Map(AGENT_TOOLS.map((tool) => [tool.name, tool]))
if (BY_NAME.size !== AGENT_TOOLS.length) throw new Error('Two agent tools share a name.')

export function findAgentTool(name: string): AgentTool | undefined {
  return BY_NAME.get(name)
}
