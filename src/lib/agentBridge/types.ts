/**
 * The agent bridge: what the creator's own AI agent (Claude Code, Codex, Cursor, connected with
 * `npx @sts-ai/cli init`) can do in sts-ai over MCP.
 *
 * Every app area (knowledge, integrations, leads, social… and any future page) registers its
 * tools in one file under ./areas and adds it to ./registry.ts. Two kinds:
 *
 * - read: answered at once (business facts, lists, statuses).
 * - write: never acts directly. It becomes an AgentRequest the creator allows or denies in
 *   Lead → Approval; `apply` runs only after that (or at once if they "always allowed" the tool).
 */

export type AgentContext = {
  userId: string
  tokenId: string
  client: string
}

export type JsonSchema = Record<string, unknown>

/** What a write tool turns its input into before anyone approves it. */
export type AgentProposal = {
  /** Verb phrase for the approval row: "Answer", "Connect", "Import". */
  title: string
  /** The object, shown in mono next to the title: a question, a URL, a workflow name. */
  detail?: string
  /** The input as it will be shown to the creator. Never put secrets here. */
  display: Record<string, unknown>
  /** What `apply` needs, stored with the request (secrets go in `secrets`). */
  payload: Record<string, unknown>
  /** Values kept encrypted and only given to `apply`. */
  secrets?: Record<string, string>
}

type ToolBase = {
  /** snake_case, unique across all areas. */
  name: string
  area: AgentArea
  /** Short human name for the tool. */
  title: string
  /** What the agent reads to decide when to call it. */
  description: string
  inputSchema: JsonSchema
}

export type AgentReadTool = ToolBase & {
  kind: 'read'
  run: (ctx: AgentContext, input: Record<string, unknown>) => Promise<AgentToolOutput>
}

export type AgentWriteTool = ToolBase & {
  kind: 'write'
  /**
   * approve (default): waits in Lead → Approval. direct: applied at once and only logged, for
   * internal, low-risk edits (answers, the description) where asking adds no value.
   */
  policy?: 'approve' | 'direct'
  /** Checks the input and describes the change. Throw AgentInputError for bad input. */
  propose: (ctx: AgentContext, input: Record<string, unknown>) => Promise<AgentProposal>
  /** Makes the change, after approval. Returns what the agent is told. */
  apply: (ctx: AgentContext, payload: Record<string, unknown>, secrets: Record<string, string>) => Promise<unknown>
}

export type AgentTool = AgentReadTool | AgentWriteTool

/** Text for the agent, optionally with structured JSON. */
export type AgentToolOutput = string | { text: string; structured?: Record<string, unknown> }

export const AGENT_AREAS = {
  brain: { label: 'Business brain', href: '/services/publish' },
  knowledge: { label: 'Knowledge', href: '/projects/questions' },
  integrations: { label: 'Integrations', href: '/integrations' },
  leads: { label: 'Leads', href: '/lead/list' },
  messages: { label: 'Messages', href: '/social?inbox=1' },
  social: { label: 'Social', href: '/social' },
  services: { label: 'Services', href: '/services' },
  requests: { label: 'Approvals', href: '/lead/approval' },
} as const

export type AgentArea = keyof typeof AGENT_AREAS

/** Bad input from the agent: the message goes back to it as a tool error. */
export class AgentInputError extends Error {}

/* Small input readers, so each tool states its rules in one line. */

export function str(input: Record<string, unknown>, key: string, opts: { max: number; required?: boolean }): string {
  const value = input[key]
  if (value === undefined || value === null || value === '') {
    if (opts.required) throw new AgentInputError(`"${key}" is required.`)
    return ''
  }
  if (typeof value !== 'string') throw new AgentInputError(`"${key}" must be a string.`)
  const trimmed = value.trim()
  if (opts.required && !trimmed) throw new AgentInputError(`"${key}" is required.`)
  if (trimmed.length > opts.max) throw new AgentInputError(`"${key}" is longer than ${opts.max} characters.`)
  return trimmed
}

export function int(input: Record<string, unknown>, key: string, opts: { min: number; max: number; fallback: number }): number {
  const value = input[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) return opts.fallback
  return Math.min(opts.max, Math.max(opts.min, Math.round(value)))
}
