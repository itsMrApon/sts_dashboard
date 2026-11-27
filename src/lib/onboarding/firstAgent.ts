import 'server-only'
import type { Prisma } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { draftAssistant, type AssistantDraft, type AssistantLanguageChoice } from '@/lib/agents/assistantDraft'
import { ASSISTANT_SERVICE_META, type AssistantService } from '@/lib/agents/assistantServices'
import { cleanAssistantBehaviour } from '@/lib/agents/assistantWrites'
import { getEngineForUser } from '@/lib/agents/engineSettings'
import { SERVICE_KIND, linkedAgentId } from '@/lib/services/serviceConfig'

/**
 * The first agents from setup (one per service the creator picked: chat, voice, form, tour), built
 * after the response so the creator never waits on Gemini. Progress is kept in memory per creator
 * (one server process); after a restart the agents are simply there in AI Agents, or not yet.
 */
export type FirstAgentBuild = {
  /** ready = at least one agent was built; failed = none could be. */
  status: 'building' | 'ready' | 'failed'
  services: AssistantService[]
  /** Names of the agents that were built, in the order of `services`. */
  agentNames: string[]
  /** True when Gemini couldn't write one of them and the starter prompt was used. */
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

/** Setup's input: the same answers, for every service the creator picked. */
export type FirstAgentsInput = Omit<FirstAgentInput, 'service'> & { services: AssistantService[] }

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
  const behaviour = cleanAssistantBehaviour(input.service, draft.behaviour)

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

/**
 * Builds one agent per picked service, side by side (each is one Gemini draft). Meant to run in
 * `after()`; never throws. One failing service doesn't stop the others.
 */
export async function runFirstAgentBuild(input: FirstAgentsInput): Promise<void> {
  const { services, ...answers } = input
  markFirstAgentBuilding(input.userId, services)
  const results = await Promise.allSettled(services.map((service) => buildFirstAgent({ ...answers, service })))
  const built: { name: string; starter: boolean }[] = []
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') built.push(result.value)
    else console.error(`[firstAgent] ${services[i]}:`, result.reason instanceof Error ? result.reason.message : result.reason)
  })
  builds.set(input.userId, {
    status: built.length ? 'ready' : 'failed',
    services,
    agentNames: built.map((agent) => agent.name),
    starter: built.some((agent) => agent.starter),
  })
}

/** Set before the response, so the next card's first status check already sees "building". */
export function markFirstAgentBuilding(userId: string, services: AssistantService[]): void {
  builds.set(userId, { status: 'building', services, agentNames: [], starter: false })
}
