/** Client-safe catalog of "Edit with AI" quick actions for the agent Model section. */

export type AgentAiField = 'systemPrompt' | 'firstMessage'

export type AgentAiQuickAction = 'improve' | 'shorten' | 'guardrails' | 'voice' | 'bangla' | 'fromCalls'

export const AGENT_AI_QUICK_ACTIONS: { id: AgentAiQuickAction; label: string; fields: AgentAiField[] }[] = [
  { id: 'improve', label: 'Improve', fields: ['systemPrompt', 'firstMessage'] },
  { id: 'shorten', label: 'Make shorter', fields: ['systemPrompt', 'firstMessage'] },
  { id: 'voice', label: 'Optimize for voice', fields: ['systemPrompt'] },
  { id: 'guardrails', label: 'Add guardrails', fields: ['systemPrompt'] },
  { id: 'bangla', label: 'বাংলা', fields: ['systemPrompt', 'firstMessage'] },
  { id: 'fromCalls', label: 'Fix from recent calls', fields: ['systemPrompt'] },
]

export function isAgentAiQuickAction(value: unknown): value is AgentAiQuickAction {
  return AGENT_AI_QUICK_ACTIONS.some((action) => action.id === value)
}

export const AI_INSTRUCTION_MAX = 1_000
