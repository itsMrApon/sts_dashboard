import 'server-only'
import type { Prisma } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { draftAssistant, type AssistantDraft, type AssistantLanguageChoice } from '@/lib/agents/assistantDraft'
import { ASSISTANT_SERVICE_META, LOOK_KEYS, splitServiceConfig, type AssistantService } from '@/lib/agents/assistantServices'
import { getEngineForUser } from '@/lib/agents/engineSettings'
import { SERVICE_KIND, linkedAgentId } from '@/lib/services/serviceConfig'
import { sanitizeChatConfig, sanitizeFormConfig, sanitizeSpeakConfig } from '@/lib/services/types'

/**
 * The first agent from setup, built after the response so the creator never waits on Gemini.
 * Progress is kept in memory per creator (one server process); after a restart the agent is
 * simply there in AI Agents, or not yet.
 */
export type FirstAgentBuild = {
  status: 'building' | 'ready' | 'failed'
  service: AssistantService
  agentName: string | null
  /** True when Gemini couldn't write it and the starter prompt was used. */
  starter: boolean
}

const globalBuilds = globalThis as unknown as { __stsFirstAgentBuilds?: Map<string, FirstAgentBuild> }
const builds = (globalBuilds.__stsFirstAgentBuilds ??= new Map<string, FirstAgentBuild>())

export function getFirstAgentBuild(userId: string): FirstAgentBuild | null {
  return builds.get(userId) ?? null
}

export type FirstAgentInput = {
  userId: string
  workspaceId: string
  businessName: string
  service: AssistantService
  goals: string[]
  tone: string
  language: AssistantLanguageChoice
}

/** Same cleaning the services use: only behaviour keys, never looks. */
function cleanBehaviour(service: AssistantService, raw: unknown): Prisma.InputJsonObject {
  if (service === 'tour') return {}
  const sanitized = service === 'chat' ? sanitizeChatConfig(raw) : service === 'voice' ? sanitizeSpeakConfig(raw) : sanitizeFormConfig(raw)
  return splitServiceConfig(sanitized, LOOK_KEYS[service]).behaviour as Prisma.InputJsonObject
}

/** Used when Gemini can't write the draft: a plain, editable prompt so setup never dead-ends. */
function starterDraft(input: FirstAgentInput): AssistantDraft {
  const meta = ASSISTANT_SERVICE_META[input.service]
  const language: 'en' | 'bn' = input.language === 'bn' ? 'bn' : 'en'
  return {
    name: `${input.businessName} ${meta.label}`.slice(0, 80),
    systemPrompt: [
      '# Role',
      `You are the ${meta.noun} for ${input.businessName}. ${meta.description}`,
      '# Style',
      `Tone: ${input.tone}. Keep replies short and clear.`,
      input.language === 'both'
        ? 'Reply in the language the visitor uses (Bangla or English).'
        : input.language === 'bn'
          ? 'Reply in Bangla.'
          : 'Reply in English.',
      '# Rules',
      'Use only the business details you are given. Never invent prices, policies or availability.',
      'When you are unsure, offer to connect the visitor with the team.',
    ].join('\n'),
    firstMessage: `Hi! Welcome to ${input.businessName}. How can I help?`,
    language,
    behaviour: {},
  }
}

async function buildFirstAgent(input: FirstAgentInput): Promise<{ name: string; starter: boolean }> {
  const drafted = await draftAssistant({
    userId: input.userId,
    workspaceId: input.workspaceId,
    businessName: input.businessName,
    businessDescription: null,
    service: input.service,
    goals: input.goals,
    goalNote: '',
    tone: input.tone,
    language: input.language,
    sources: [],
  })
  if (!drafted.ok) console.warn('[firstAgent] draft failed, using the starter prompt:', drafted.error)
  const draft = drafted.ok ? drafted.draft : starterDraft(input)
  const behaviour = cleanBehaviour(input.service, draft.behaviour)

  const { engine } = await getEngineForUser(input.userId)
  const created = await prismaClient.liveKitAgent.create({
    data: {
      userId: input.userId,
      name: draft.name,
      roomName: `room-${Math.random().toString(36).slice(2, 10)}`,
      service: input.service,
      serviceSettings: (Object.keys(behaviour).length ? { [input.service]: behaviour } : {}) as Prisma.InputJsonObject,
      systemPrompt: draft.systemPrompt,
      firstMessage: draft.firstMessage || null,
      language: draft.language,
      llmProvider: engine.llmProvider,
      llmModel: engine.llmModel,
      voiceProvider: engine.voiceProvider,
      voiceModel: engine.voiceModel,
    },
    select: { id: true },
  })

  // Runs the service only when nothing runs it yet (never replaces the creator's choice).
  const kind = SERVICE_KIND[input.service]
  const slot = await prismaClient.serviceConfig.findUnique({
    where: { workspaceId_kind: { workspaceId: input.workspaceId, kind } },
    select: { config: true },
  })
  if (!linkedAgentId(slot?.config)) {
    const config = { ...((slot?.config as Record<string, unknown> | null) ?? {}), agentId: created.id }
    await prismaClient.serviceConfig.upsert({
      where: { workspaceId_kind: { workspaceId: input.workspaceId, kind } },
      create: { workspaceId: input.workspaceId, kind, enabled: false, config: config as Prisma.InputJsonObject },
      update: { config: config as Prisma.InputJsonObject },
    })
  }
  return { name: draft.name, starter: !drafted.ok }
}

/** Marks the build as running, then does it. Meant to run in `after()`; never throws. */
export async function runFirstAgentBuild(input: FirstAgentInput): Promise<void> {
  builds.set(input.userId, { status: 'building', service: input.service, agentName: null, starter: false })
  try {
    const { name, starter } = await buildFirstAgent(input)
    builds.set(input.userId, { status: 'ready', service: input.service, agentName: name, starter })
  } catch (error) {
    console.error('[firstAgent]', error instanceof Error ? error.message : error)
    builds.set(input.userId, { status: 'failed', service: input.service, agentName: null, starter: false })
  }
}

/** Set before the response, so the next card's first status check already sees "building". */
export function markFirstAgentBuilding(userId: string, service: AssistantService): void {
  builds.set(userId, { status: 'building', service, agentName: null, starter: false })
}
