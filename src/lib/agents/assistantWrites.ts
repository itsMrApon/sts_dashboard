import 'server-only'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { aiAgentPrompt } from '@/lib/data'
import { ensureAgentEditAccess } from '@/lib/agents/agentAccess'
import {
  ASSISTANT_SERVICE_META,
  LOOK_KEYS,
  canRunService,
  isAssistantService,
  splitServiceConfig,
  type AssistantService,
} from '@/lib/agents/assistantServices'
import { isAgentLanguage } from '@/lib/agents/engineOptions'
import { getEngineForUser } from '@/lib/agents/engineSettings'
import { SERVICE_KIND, getBusinessServices } from '@/lib/services/serviceConfig'
import { sanitizeChatConfig, sanitizeFormConfig, sanitizeSpeakConfig } from '@/lib/services/types'

/**
 * Assistant writes shared by AI Agents (server actions, signed in with Clerk) and the agent bridge
 * (the creator's own AI agent over MCP). Callers pass the creator they already authenticated.
 * Text is stored exactly as given, Bangla included.
 */

export type AssistantWriteResult<T = object> = ({ ok: true } & T) | { ok: false; error: string }
export type AssistantOwner = { userId: string; workspaceId: string }

export const ASSISTANT_LIMITS = { name: 80, prompt: 40_000, firstMessage: 1_000 } as const

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export function generateAssistantRoomName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `room-${slug || 'assistant'}-${Math.random().toString(36).slice(2, 8)}`
}

/** Behaviour part of a service config, cleaned by the same sanitizer the service uses. */
export function cleanAssistantBehaviour(service: AssistantService, raw: unknown): Prisma.InputJsonObject {
  if (service === 'tour') return {}
  const sanitized =
    service === 'chat' ? sanitizeChatConfig(raw) : service === 'voice' ? sanitizeSpeakConfig(raw) : sanitizeFormConfig(raw)
  return splitServiceConfig(sanitized, LOOK_KEYS[service]).behaviour as Prisma.InputJsonObject
}

export function revalidateAssistants() {
  revalidateTag('livekit-agents')
  revalidatePath('/ai-agents')
  revalidatePath('/services', 'layout')
}

/**
 * Makes `agentId` the assistant that runs `service` (null unlinks it, which takes the service
 * offline). The first time an assistant takes over, it copies the service's current behaviour,
 * so nothing the creator set up is lost.
 */
export async function linkAssistantForOwner(
  owner: AssistantOwner,
  service: AssistantService,
  agentId: string | null,
): Promise<AssistantWriteResult> {
  if (!isAssistantService(service)) return { ok: false, error: 'Unknown service' }
  const kind = SERVICE_KIND[service]

  if (agentId) {
    const access = await ensureAgentEditAccess(agentId, owner.userId)
    if (!access.ok) return { ok: false, error: 'Assistant not found' }
    const agent = await prismaClient.liveKitAgent.findUnique({
      where: { id: access.agentId },
      select: { service: true, serviceSettings: true },
    })
    if (!agent || !canRunService(agent.service, service)) {
      return {
        ok: false,
        error: `This assistant is made for ${ASSISTANT_SERVICE_META[(agent?.service ?? service) as AssistantService]?.label ?? 'another service'}.`,
      }
    }
    const settings = record(agent.serviceSettings)
    if (service !== 'tour' && !settings[service]) {
      const current = await getBusinessServices(owner.workspaceId)
      const live = service === 'chat' ? current.chat.config : service === 'voice' ? current.speak.config : current.form.config
      await prismaClient.liveKitAgent.update({
        where: { id: access.agentId },
        data: { serviceSettings: { ...settings, [service]: cleanAssistantBehaviour(service, live) } as Prisma.InputJsonObject },
      })
    }
  }

  const existing = await prismaClient.serviceConfig.findUnique({
    where: { workspaceId_kind: { workspaceId: owner.workspaceId, kind } },
    select: { config: true, enabled: true },
  })
  const config = { ...record(existing?.config) }
  if (agentId) config.agentId = agentId
  else delete config.agentId
  await prismaClient.serviceConfig.upsert({
    where: { workspaceId_kind: { workspaceId: owner.workspaceId, kind } },
    create: { workspaceId: owner.workspaceId, kind, enabled: false, config: config as Prisma.InputJsonObject },
    // Unlinking turns the service off: it can't run without an assistant.
    update: { config: config as Prisma.InputJsonObject, ...(agentId ? {} : { enabled: false }) },
  })
  revalidateAssistants()
  return { ok: true }
}

/** Saves an assistant's behaviour for its service (Chat greeting, Form questions, call length…). */
export async function saveAssistantBehaviourForOwner(
  userId: string,
  agentId: string,
  service: AssistantService,
  settings: unknown,
): Promise<AssistantWriteResult<{ settings: Record<string, unknown> }>> {
  if (!isAssistantService(service) || service === 'tour') return { ok: false, error: 'Unknown service' }
  const access = await ensureAgentEditAccess(agentId, userId)
  if (!access.ok) return { ok: false, error: 'Assistant not found' }
  const agent = await prismaClient.liveKitAgent.findUnique({
    where: { id: access.agentId },
    select: { service: true, serviceSettings: true },
  })
  if (!agent || !canRunService(agent.service, service)) return { ok: false, error: 'This assistant is made for another service.' }
  const behaviour = cleanAssistantBehaviour(service, settings)
  await prismaClient.liveKitAgent.update({
    where: { id: access.agentId },
    data: { serviceSettings: { ...record(agent.serviceSettings), [service]: behaviour } as Prisma.InputJsonObject },
  })
  revalidateAssistants()
  return { ok: true, settings: behaviour }
}

export type NewAssistantInput = {
  name: string
  service: AssistantService
  systemPrompt?: string
  firstMessage?: string
  language?: string
  /** Service behaviour drafted for it (greeting, questions…). */
  behaviour?: unknown
  /** Make it run the service: always, or only when the service has no assistant yet. */
  link?: boolean | 'if-free'
}

/** Creates an assistant made for one service. */
export async function createAssistantForOwner(
  owner: AssistantOwner,
  input: NewAssistantInput,
): Promise<AssistantWriteResult<{ id: string; linked: boolean }>> {
  if (!isAssistantService(input.service)) return { ok: false, error: 'Pick a service for the assistant' }
  const name = (input.name ?? '').trim().slice(0, ASSISTANT_LIMITS.name)
  if (!name) return { ok: false, error: 'Give the assistant a name' }
  const systemPrompt = (input.systemPrompt ?? '').slice(0, ASSISTANT_LIMITS.prompt) || aiAgentPrompt
  const firstMessage = (input.firstMessage ?? '').slice(0, ASSISTANT_LIMITS.firstMessage)
  const language = isAgentLanguage(input.language) ? input.language : 'en'
  const behaviour =
    input.behaviour === undefined || input.service === 'tour' ? {} : cleanAssistantBehaviour(input.service, input.behaviour)

  // The engine is account-wide; only its legacy per-agent columns are copied (the rest of the
  // engine settings aren't columns on an assistant).
  const { engine } = await getEngineForUser(owner.userId)
  let created: { id: string }
  try {
    created = await prismaClient.liveKitAgent.create({
      data: {
        userId: owner.userId,
        name,
        roomName: generateAssistantRoomName(name),
        service: input.service,
        serviceSettings: (Object.keys(behaviour).length ? { [input.service]: behaviour } : {}) as Prisma.InputJsonObject,
        systemPrompt,
        firstMessage: firstMessage || null,
        language,
        llmProvider: engine.llmProvider,
        llmModel: engine.llmModel,
        voiceProvider: engine.voiceProvider,
        voiceModel: engine.voiceModel,
      },
      select: { id: true },
    })
  } catch (error) {
    console.error('[createAssistant]', error instanceof Error ? error.message : error)
    return { ok: false, error: 'Could not save the assistant. Please try again.' }
  }
  let linked = false
  if (input.link) {
    const free = input.link === true ? true : !(await serviceHasAssistant(owner.workspaceId, input.service))
    if (free) {
      const result = await linkAssistantForOwner(owner, input.service, created.id)
      if (!result.ok) return result
      linked = true
    }
  }
  revalidateAssistants()
  return { ok: true, id: created.id, linked }
}

async function serviceHasAssistant(workspaceId: string, service: AssistantService): Promise<boolean> {
  const current = await getBusinessServices(workspaceId)
  const slot = service === 'chat' ? current.chat : service === 'voice' ? current.speak : service === 'form' ? current.form : current.tour
  return Boolean(slot.agent)
}

/** Edits an assistant's name, prompt, first message or language. Fields left undefined stay. */
export async function updateAssistantForOwner(
  userId: string,
  agentId: string,
  input: { name?: string; systemPrompt?: string; firstMessage?: string; language?: string },
): Promise<AssistantWriteResult> {
  const access = await ensureAgentEditAccess(agentId, userId)
  if (!access.ok) return { ok: false, error: 'Assistant not found' }
  const data: Prisma.LiveKitAgentUpdateInput = {}
  if (input.name !== undefined) {
    const name = input.name.trim().slice(0, ASSISTANT_LIMITS.name)
    if (!name) return { ok: false, error: 'Give the assistant a name' }
    data.name = name
  }
  if (input.systemPrompt !== undefined) {
    if (!input.systemPrompt.trim()) return { ok: false, error: 'The prompt cannot be empty' }
    data.systemPrompt = input.systemPrompt.slice(0, ASSISTANT_LIMITS.prompt)
  }
  if (input.firstMessage !== undefined) data.firstMessage = input.firstMessage.slice(0, ASSISTANT_LIMITS.firstMessage) || null
  if (input.language !== undefined) {
    if (!isAgentLanguage(input.language)) return { ok: false, error: 'Unknown language' }
    data.language = input.language
  }
  if (!Object.keys(data).length) return { ok: false, error: 'Nothing to change' }
  await prismaClient.liveKitAgent.update({ where: { id: access.agentId }, data })
  revalidateAssistants()
  return { ok: true }
}
