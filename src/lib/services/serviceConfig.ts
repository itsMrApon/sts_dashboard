import 'server-only'
import { WebServiceKind, type Prisma } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { LOOK_KEYS, canRunService, isAssistantService, type AssistantService } from '@/lib/agents/assistantServices'
import {
  sanitizeChatConfig,
  sanitizeFormConfig,
  sanitizeSpeakConfig,
  type ChatServiceConfig,
  type FormServiceConfig,
  type ServiceState,
  type SpeakServiceConfig,
} from '@/lib/services/types'

/** The /ai-agents assistant that runs a service. */
export type ServiceAssistant = {
  id: string
  name: string
  /** Null = classic assistant (usable by any service). */
  service: AssistantService | null
  systemPrompt: string | null
  firstMessage: string | null
  language: string
}

export type ServiceSlot<T> = ServiceState<T> & {
  /** The linked assistant; a service can't be live without one. */
  agent: ServiceAssistant | null
}

export type BusinessServices = {
  chat: ServiceSlot<ChatServiceConfig>
  speak: ServiceSlot<SpeakServiceConfig>
  form: ServiceSlot<FormServiceConfig>
  /** The business tour's guide. Tour content itself lives in VoiceWizard. */
  tour: { agent: ServiceAssistant | null }
}

export const SERVICE_KIND: Record<AssistantService, WebServiceKind> = {
  chat: WebServiceKind.CHAT,
  voice: WebServiceKind.SPEAK,
  form: WebServiceKind.FORM,
  tour: WebServiceKind.TOUR,
}

const ASSISTANT_SELECT = {
  id: true,
  name: true,
  service: true,
  systemPrompt: true,
  firstMessage: true,
  language: true,
  serviceSettings: true,
} as const

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

/** The assistant id a service row links to (stored next to the service's own config). */
export function linkedAgentId(config: unknown): string | null {
  const id = record(config).agentId
  return typeof id === 'string' && id ? id : null
}

/**
 * All services for a business, each merged from two sources: behaviour from the linked assistant
 * (falling back to what the service row holds, for classic assistants), looks from the service.
 * A service only counts as on when its switch is on AND it has an assistant.
 */
export async function getBusinessServices(workspaceId: string): Promise<BusinessServices> {
  const [rows, workspace] = await Promise.all([
    prismaClient.serviceConfig.findMany({ where: { workspaceId }, select: { kind: true, enabled: true, config: true } }),
    prismaClient.workspace.findUnique({ where: { id: workspaceId }, select: { userId: true } }),
  ])
  const byKind = new Map(rows.map((row) => [row.kind, row]))
  const agentIds = [...new Set(rows.map((row) => linkedAgentId(row.config)).filter((id): id is string => Boolean(id)))]
  const agents = agentIds.length
    ? await prismaClient.liveKitAgent.findMany({
        // Only the business owner's assistants (or classic unowned ones) can run its services.
        where: { id: { in: agentIds }, OR: [{ userId: workspace?.userId ?? '' }, { userId: null }] },
        select: ASSISTANT_SELECT,
      })
    : []

  const assistantFor = (service: AssistantService) => {
    const id = linkedAgentId(byKind.get(SERVICE_KIND[service])?.config)
    const agent = agents.find((row) => row.id === id && canRunService(row.service, service))
    return agent ?? null
  }

  function slot<T>(service: 'chat' | 'voice' | 'form', sanitize: (raw: unknown) => T): ServiceSlot<T> {
    const row = byKind.get(SERVICE_KIND[service])
    const stored = record(row?.config)
    const agent = assistantFor(service)
    const behaviour = record(record(agent?.serviceSettings)[service])
    const look = Object.fromEntries(LOOK_KEYS[service].filter((key) => key in stored).map((key) => [key, stored[key]]))
    return {
      enabled: Boolean(row?.enabled && agent),
      config: sanitize({ ...stored, ...behaviour, ...look }),
      agent: agent ? toAssistant(agent) : null,
    }
  }

  const tourAgent = assistantFor('tour')
  return {
    chat: slot('chat', sanitizeChatConfig),
    speak: slot('voice', sanitizeSpeakConfig),
    form: slot('form', sanitizeFormConfig),
    tour: { agent: tourAgent ? toAssistant(tourAgent) : null },
  }
}

function toAssistant(row: {
  id: string
  name: string
  service: string | null
  systemPrompt: string | null
  firstMessage: string | null
  language: string
}): ServiceAssistant {
  return {
    id: row.id,
    name: row.name,
    service: isAssistantService(row.service) ? row.service : null,
    systemPrompt: row.systemPrompt,
    firstMessage: row.firstMessage,
    language: row.language,
  }
}

/** Saves a service's looks and switch. The linked assistant is kept unless `agentId` is given. */
export async function saveServiceConfig(
  workspaceId: string,
  kind: WebServiceKind,
  enabled: boolean,
  config: Prisma.InputJsonObject,
  agentId?: string | null,
) {
  const existing = await prismaClient.serviceConfig.findUnique({
    where: { workspaceId_kind: { workspaceId, kind } },
    select: { config: true },
  })
  const keep = agentId === undefined ? linkedAgentId(existing?.config) : agentId
  const stored: Prisma.InputJsonObject = keep ? { ...config, agentId: keep } : config
  await prismaClient.serviceConfig.upsert({
    where: { workspaceId_kind: { workspaceId, kind } },
    create: { workspaceId, kind, enabled, config: stored },
    update: { enabled, config: stored },
  })
}
