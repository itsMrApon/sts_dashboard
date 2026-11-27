'use server'

import type { Prisma } from '@prisma/client'
import { onAuthenticateUser } from '@/actions/auth'
import { prismaClient } from '@/lib/prismaClient'
import { ensureAgentEditAccess, myAssistantsWhere } from '@/lib/agents/agentAccess'
import { canRunService, isAssistantService, type AssistantService } from '@/lib/agents/assistantServices'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'
import {
  ASSISTANT_LIMITS,
  createAssistantForOwner,
  linkAssistantForOwner,
  revalidateAssistants,
  saveAssistantBehaviourForOwner,
  type NewAssistantInput,
} from '@/lib/agents/assistantWrites'
import { SERVICE_KIND, linkedAgentId } from '@/lib/services/serviceConfig'
import { sanitizeChatConfig } from '@/lib/services/types'
import { chatStyleInstruction } from '@/lib/services/persona'
import { buildAgentContext } from '@/lib/messages/buildAgentContext'
import { generateReply } from '@/lib/messages/geminiText'
import { decryptToken } from '@/lib/messages/encrypt'
import { getUserVoiceCredentialByUserId } from '@/lib/voiceCredentialsRepo'
import {
  draftAssistant,
  readBusinessLinks,
  type AssistantDraft,
  type AssistantLanguageChoice,
  type LinkSource,
} from '@/lib/agents/assistantDraft'

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

export type AssistantSummary = {
  id: string
  name: string
  /** Null = classic assistant (made before per-service assistants; any service may use it). */
  service: AssistantService | null
  /** Services this assistant runs right now. */
  inUse: AssistantService[]
  /** Holds the business's public address: can't be deleted. */
  isBusinessAddress: boolean
  language: string
  firstMessage: string
  systemPrompt: string
  updatedAt: string
}

const NAME_MAX = ASSISTANT_LIMITS.name

async function signedInBusiness() {
  const auth = await onAuthenticateUser()
  if (!auth.user) return null
  const business = await getCreatorBusiness(auth.user.id)
  return business ? { userId: auth.user.id, business } : null
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

/** The signed-in creator's assistants, with what each one runs. */
export async function listAssistants(): Promise<AssistantSummary[]> {
  const me = await signedInBusiness()
  if (!me) return []
  const [agents, rows] = await Promise.all([
    prismaClient.liveKitAgent.findMany({
      where: myAssistantsWhere(me.userId),
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, service: true, language: true, firstMessage: true, systemPrompt: true, updatedAt: true },
    }),
    prismaClient.serviceConfig.findMany({
      where: { workspaceId: me.business.workspaceId },
      select: { kind: true, config: true },
    }),
  ])
  const users = new Map<string, AssistantService[]>()
  for (const service of Object.keys(SERVICE_KIND) as AssistantService[]) {
    const id = linkedAgentId(rows.find((row) => row.kind === SERVICE_KIND[service])?.config)
    if (id) users.set(id, [...(users.get(id) ?? []), service])
  }
  const summaries = agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    service: isAssistantService(agent.service) ? agent.service : null,
    inUse: (users.get(agent.id) ?? []).filter((service) => canRunService(agent.service, service)),
    isBusinessAddress: agent.id === me.business.agentId,
    language: agent.language,
    firstMessage: agent.firstMessage ?? '',
    systemPrompt: agent.systemPrompt ?? '',
    updatedAt: agent.updatedAt.toISOString(),
  }))
  // Assistants that run something come first (the rest keep their creation order).
  return [...summaries.filter((item) => item.inUse.length > 0), ...summaries.filter((item) => item.inUse.length === 0)]
}

/** One assistant's service behaviour (merged with the live service when it runs it). */
export async function getAssistantServiceSettings(agentId: string): Promise<Result<{ settings: Record<string, unknown> }>> {
  const me = await signedInBusiness()
  if (!me) return { ok: false, error: 'UNAUTHENTICATED' }
  const access = await ensureAgentEditAccess(agentId, me.userId)
  if (!access.ok) return { ok: false, error: 'Assistant not found' }
  const agent = await prismaClient.liveKitAgent.findUnique({ where: { id: access.agentId }, select: { serviceSettings: true } })
  return { ok: true, settings: record(agent?.serviceSettings) }
}

/**
 * Makes `agentId` the assistant that runs `service` (null unlinks it, which takes the service
 * offline). Shared with the agent bridge: see linkAssistantForOwner.
 */
export async function linkAssistantToService(service: AssistantService, agentId: string | null): Promise<Result> {
  const me = await signedInBusiness()
  if (!me) return { ok: false, error: 'UNAUTHENTICATED' }
  return linkAssistantForOwner({ userId: me.userId, workspaceId: me.business.workspaceId }, service, agentId)
}

/** Saves an assistant's behaviour for its service (Chat greeting, Form questions, call length…). */
export async function saveAssistantBehaviour(
  agentId: string,
  service: AssistantService,
  settings: unknown,
): Promise<Result<{ settings: Record<string, unknown> }>> {
  const me = await signedInBusiness()
  if (!me) return { ok: false, error: 'UNAUTHENTICATED' }
  return saveAssistantBehaviourForOwner(me.userId, agentId, service, settings)
}

export type { NewAssistantInput }

/** Creates an assistant made for one service. Text is stored exactly as given (Bangla intact). */
export async function createAssistant(input: NewAssistantInput): Promise<Result<{ id: string; linked: boolean }>> {
  const me = await signedInBusiness()
  if (!me) return { ok: false, error: 'UNAUTHENTICATED' }
  return createAssistantForOwner({ userId: me.userId, workspaceId: me.business.workspaceId }, input)
}

/** New assistant, step 2: what the creator's links say (via the website reader). */
export async function researchAssistantLinks(links: string[]): Promise<Result<{ sources: LinkSource[]; reader: boolean }>> {
  const me = await signedInBusiness()
  if (!me) return { ok: false, error: 'UNAUTHENTICATED' }
  const clean = (Array.isArray(links) ? links : []).filter((link) => typeof link === 'string').slice(0, 10)
  return { ok: true, ...(await readBusinessLinks(me.userId, clean)) }
}

/** New assistant, step 3: the AI writes its name, prompt, first line and service behaviour. Not saved. */
export async function draftNewAssistant(input: {
  service: AssistantService
  goals: string[]
  goalNote: string
  tone: string
  language: AssistantLanguageChoice
  sources: LinkSource[]
}): Promise<Result<{ draft: AssistantDraft }>> {
  const me = await signedInBusiness()
  if (!me) return { ok: false, error: 'UNAUTHENTICATED' }
  if (!isAssistantService(input.service)) return { ok: false, error: 'Pick a service' }
  const language: AssistantLanguageChoice = input.language === 'bn' || input.language === 'both' ? input.language : 'en'
  const result = await draftAssistant({
    userId: me.userId,
    workspaceId: me.business.workspaceId,
    businessName: me.business.name,
    businessDescription: me.business.description,
    service: input.service,
    goals: (Array.isArray(input.goals) ? input.goals : []).filter((goal) => typeof goal === 'string').slice(0, 6),
    goalNote: typeof input.goalNote === 'string' ? input.goalNote : '',
    tone: typeof input.tone === 'string' ? input.tone.slice(0, 40) : 'friendly',
    language,
    // Link facts from step 2, carried back by the creator's browser. They are the creator's own
    // input to their own assistant, so they get the same trust as typed notes.
    sources: (Array.isArray(input.sources) ? input.sources : [])
      .filter((source) => source && typeof source.url === 'string' && typeof source.summary === 'string')
      .slice(0, 3)
      .map((source) => ({ url: source.url.slice(0, 500), ok: Boolean(source.ok), summary: source.summary.slice(0, 3000) })),
  })
  return result.ok ? { ok: true, draft: result.draft } : result
}

/** Renames an assistant. (Prompt, first message and language: updateLiveKitAgent.) */
export async function renameAssistant(agentId: string, name: string): Promise<Result> {
  const me = await signedInBusiness()
  if (!me) return { ok: false, error: 'UNAUTHENTICATED' }
  const clean = (name ?? '').trim().slice(0, NAME_MAX)
  if (!clean) return { ok: false, error: 'Give the assistant a name' }
  const access = await ensureAgentEditAccess(agentId, me.userId)
  if (!access.ok) return { ok: false, error: 'Assistant not found' }
  await prismaClient.liveKitAgent.update({ where: { id: access.agentId }, data: { name: clean } })
  revalidateAssistants()
  return { ok: true }
}

/** Deletes an assistant. Services it ran go offline until another assistant is picked. */
export async function deleteAssistant(agentId: string): Promise<Result> {
  const me = await signedInBusiness()
  if (!me) return { ok: false, error: 'UNAUTHENTICATED' }
  const access = await ensureAgentEditAccess(agentId, me.userId)
  if (!access.ok) return { ok: false, error: 'Assistant not found' }
  // The business's public links (/chat/<room>, site key) hang off this assistant's room.
  if (access.agentId === me.business.agentId) {
    return { ok: false, error: "This assistant holds your business's public address, so it can't be deleted. You can still stop using it for every service." }
  }
  const rows = await prismaClient.serviceConfig.findMany({
    where: { workspaceId: me.business.workspaceId },
    select: { kind: true, config: true },
  })
  for (const row of rows) {
    if (linkedAgentId(row.config) !== access.agentId) continue
    const config = { ...record(row.config) }
    delete config.agentId
    await prismaClient.serviceConfig.update({
      where: { workspaceId_kind: { workspaceId: me.business.workspaceId, kind: row.kind } },
      data: { config: config as Prisma.InputJsonObject, enabled: false },
    })
  }
  await prismaClient.liveKitAgent.delete({ where: { id: access.agentId } })
  revalidateAssistants()
  return { ok: true }
}

const PREVIEW_HISTORY = 12

/**
 * Owner-only test chat for an assistant that may not be live yet: replies with this assistant's
 * prompt and the (unsaved) chat settings from the editor. Nothing is stored.
 */
export async function previewAssistantChat(input: {
  agentId: string
  config: unknown
  history: { role: 'user' | 'assistant'; content: string }[]
  message: string
}): Promise<Result<{ reply: string }>> {
  const me = await signedInBusiness()
  if (!me) return { ok: false, error: 'UNAUTHENTICATED' }
  const access = await ensureAgentEditAccess(input.agentId, me.userId)
  if (!access.ok) return { ok: false, error: 'Assistant not found' }
  const message = typeof input.message === 'string' ? input.message.trim().slice(0, 4000) : ''
  if (!message) return { ok: false, error: 'Type a message' }

  const [agent, credential] = await Promise.all([
    prismaClient.liveKitAgent.findUnique({
      where: { id: access.agentId },
      select: { name: true, systemPrompt: true, firstMessage: true, llmModel: true },
    }),
    getUserVoiceCredentialByUserId(me.userId),
  ])
  if (!agent) return { ok: false, error: 'Assistant not found' }
  let apiKey: string | null = null
  try {
    apiKey = decryptToken(credential?.googleApiKey) || null
  } catch {
    apiKey = null
  }

  const context = await buildAgentContext(me.business.roomName, {
    persona: { name: agent.name, systemPrompt: agent.systemPrompt, firstMessage: agent.firstMessage },
  })
  const history = (Array.isArray(input.history) ? input.history : [])
    .filter((turn) => (turn.role === 'user' || turn.role === 'assistant') && typeof turn.content === 'string')
    .slice(-PREVIEW_HISTORY)
    .map((turn) => ({ role: turn.role, content: turn.content.slice(0, 4000), timestamp: new Date().toISOString() }))
  const result = await generateReply({
    userMessage: message,
    history,
    systemPrompt: `${context.systemInstruction}\n\n${chatStyleInstruction(sanitizeChatConfig(input.config))}`,
    llmModel: agent.llmModel || undefined,
    apiKey,
    accountUserId: me.userId,
    usageSurface: 'messages',
  })
  return result.ok ? { ok: true, reply: result.text } : { ok: false, error: result.error }
}
