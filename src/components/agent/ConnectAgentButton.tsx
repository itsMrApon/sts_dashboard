'use client'

import HoverTerminal from '@/components/ui/hover-terminal'
import { stsInitCommand } from '@/lib/social/library/buildPrompt'
import { useAgentClient } from '@/app/(protectedRoutes)/social/_lib/useSocialPrefs'

/**
 * "Install": the hover-terminal button with the sts-ai CLI command. By default the agent-only
 * command for the creator's agent; Services passes the one that asks (agent, website or both).
 */
export function ConnectAgentButton({ command }: { command?: string }) {
  const [client] = useAgentClient()
  return <HoverTerminal command={command ?? stsInitCommand(client)} />
}
