import 'server-only'
import { prismaClient } from '@/lib/prismaClient'
import type { LlmModelProvider } from '@/lib/llm/modelOptions'
import {
  DEFAULT_AGENT_ENGINE,
  isLibraryVoiceProvider,
  validateAgentEngine,
  type AgentEngine,
} from '@/lib/agents/engineOptions'

export type EngineSource = 'settings' | 'agent' | 'default'

type AgentEngineColumns = {
  llmProvider: string
  llmModel: string
  voiceProvider: string
  voiceModel: string
}

type EngineSettingsRow = AgentEngineColumns & {
  voiceLabel: string | null
  engineMode: string
  sttProvider: string
  sttModel: string | null
  voiceStyle: string | null
  realtimeProvider: string
  realtimeModel: string
  realtimeVoice: string
}

const ENGINE_SETTINGS_SELECT = {
  llmProvider: true,
  llmModel: true,
  voiceProvider: true,
  voiceModel: true,
  voiceLabel: true,
  engineMode: true,
  sttProvider: true,
  sttModel: true,
  voiceStyle: true,
  realtimeProvider: true,
  realtimeModel: true,
  realtimeVoice: true,
} as const

/**
 * Legacy per-agent columns (LLM + voice only) -> full engine on pipeline defaults. Those columns
 * store no STT, and agents made before Cartesia became the default heard with Deepgram: keep that
 * so their calls don't start needing a Cartesia key. Agents that already speak Cartesia hear with it.
 */
export function engineFromAgentColumns(agent: AgentEngineColumns | null | undefined): AgentEngine {
  if (!agent) return DEFAULT_AGENT_ENGINE
  const sttProvider = !agent.voiceProvider || agent.voiceProvider === 'cartesia' ? DEFAULT_AGENT_ENGINE.sttProvider : 'deepgram'
  const validation = validateAgentEngine({
    ...DEFAULT_AGENT_ENGINE,
    sttProvider,
    sttModel: null,
    llmProvider: agent.llmProvider || DEFAULT_AGENT_ENGINE.llmProvider,
    llmModel: agent.llmModel || DEFAULT_AGENT_ENGINE.llmModel,
    voiceProvider: agent.voiceProvider || DEFAULT_AGENT_ENGINE.voiceProvider,
    voiceModel: agent.voiceModel || DEFAULT_AGENT_ENGINE.voiceModel,
  })
  return validation.ok ? validation.engine : DEFAULT_AGENT_ENGINE
}

function engineFromSettingsRow(row: EngineSettingsRow): AgentEngine {
  const validation = validateAgentEngine({
    mode: row.engineMode,
    sttProvider: row.sttProvider,
    sttModel: row.sttModel,
    llmProvider: row.llmProvider as LlmModelProvider,
    llmModel: row.llmModel,
    voiceProvider: row.voiceProvider,
    voiceModel: row.voiceModel,
    voiceStyle: row.voiceStyle,
    realtimeProvider: row.realtimeProvider,
    realtimeModel: row.realtimeModel,
    realtimeVoice: row.realtimeVoice,
  })
  return validation.ok ? validation.engine : engineFromAgentColumns(row)
}

/**
 * The account-wide engine for a user. Before the user has saved once, mirror what their
 * agents already run (primary business agent first) so introducing the setting changes nothing.
 */
export async function getEngineForUser(
  userId: string,
): Promise<{ engine: AgentEngine; source: EngineSource; voiceLabel: string | null }> {
  const stored = await prismaClient.agentEngineSettings.findUnique({
    where: { userId },
    select: ENGINE_SETTINGS_SELECT,
  })
  if (stored) {
    return { engine: engineFromSettingsRow(stored), source: 'settings', voiceLabel: stored.voiceLabel }
  }

  const agent = await prismaClient.liveKitAgent.findFirst({
    where: { userId },
    orderBy: [{ publishAgents: { _count: 'desc' } }, { createdAt: 'asc' }],
    select: { llmProvider: true, llmModel: true, voiceProvider: true, voiceModel: true },
  })
  if (agent) return { engine: engineFromAgentColumns(agent), source: 'agent', voiceLabel: null }
  return { engine: DEFAULT_AGENT_ENGINE, source: 'default', voiceLabel: null }
}

/**
 * Runtime engine for one agent: the owner's account-wide engine when an owner is known,
 * otherwise the agent's own (legacy) columns.
 */
export async function resolveAgentEngine(
  agent: AgentEngineColumns,
  ownerUserId: string | null,
): Promise<AgentEngine> {
  if (!ownerUserId) return engineFromAgentColumns(agent)
  const stored = await prismaClient.agentEngineSettings.findUnique({
    where: { userId: ownerUserId },
    select: ENGINE_SETTINGS_SELECT,
  })
  return stored ? engineFromSettingsRow(stored) : engineFromAgentColumns(agent)
}

/**
 * Saves the account-wide engine and mirrors its LLM + voice onto every agent the user owns, so
 * readers of the legacy columns (and agents whose owner cannot be resolved) stay consistent.
 */
export async function saveEngineForUser(
  userId: string,
  input: Partial<Record<keyof AgentEngine, unknown>> & { voiceLabel?: unknown },
): Promise<{ ok: true; engine: AgentEngine; agentsUpdated: number } | { ok: false; error: string }> {
  const validation = validateAgentEngine(input)
  if (!validation.ok) return validation
  const { engine } = validation
  const voiceLabel =
    isLibraryVoiceProvider(engine.voiceProvider) && typeof input.voiceLabel === 'string'
      ? input.voiceLabel.trim().slice(0, 200) || null
      : null

  const columns = {
    llmProvider: engine.llmProvider,
    llmModel: engine.llmModel,
    voiceProvider: engine.voiceProvider,
    voiceModel: engine.voiceModel,
    voiceLabel,
    engineMode: engine.mode,
    sttProvider: engine.sttProvider,
    sttModel: engine.sttModel,
    voiceStyle: engine.voiceStyle,
    realtimeProvider: engine.realtimeProvider,
    realtimeModel: engine.realtimeModel,
    realtimeVoice: engine.realtimeVoice,
  }

  const [, mirrored] = await prismaClient.$transaction([
    prismaClient.agentEngineSettings.upsert({
      where: { userId },
      create: { userId, ...columns },
      update: columns,
    }),
    prismaClient.liveKitAgent.updateMany({
      where: { userId },
      data: {
        llmProvider: engine.llmProvider,
        llmModel: engine.llmModel,
        voiceProvider: engine.voiceProvider,
        voiceModel: engine.voiceModel,
      },
    }),
  ])
  return { ok: true, engine, agentsUpdated: mirrored.count }
}
