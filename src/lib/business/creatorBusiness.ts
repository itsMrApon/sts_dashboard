import 'server-only'
import { cache } from 'react'
import { Prisma, VideoType } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { DEFAULT_LLM_MODEL } from '@/lib/llm/defaultModel'
import { DEFAULT_AGENT_ENGINE } from '@/lib/agents/engineOptions'
import { VERTICALS, sanitizeSiteContent } from '@/lib/business/siteContent'
import { normalizeOnboardingStep, type OnboardingResumeStep } from '@/lib/business/onboarding'

/**
 * Single-business model: 1 creator = 1 workspace = 1 business profile = 1 shared AI (room).
 * Every protected feature resolves "my business" through this facade instead of taking
 * workspace / business / room ids from the client.
 */
export type CreatorBusiness = {
  userId: string
  workspaceId: string
  publishProfileId: string
  name: string
  description: string | null
  pitchMessage: string
  agentId: string
  roomName: string
  /** Setup guide step still to finish; null once onboarding is complete. */
  onboardingStep: OnboardingResumeStep | null
}

const BUSINESS_NAME_MAX = 120
const LOCATION_MAX = 120

/**
 * The workspace AI's starting prompt. It only knows what onboarding asked (name, type, location);
 * products, FAQs and policies come from the business profile at run time, and each service agent
 * the creator builds gets its own persona and prompt.
 */
function businessSystemPrompt(name: string, typeLabel: string | null, location: string | null): string {
  return [
    `You are the AI assistant for ${name}.`,
    typeLabel ? `Business type: ${typeLabel}.` : null,
    location ? `Location: ${location}.` : null,
    'Answer questions about the business, its services and products clearly and briefly.',
    'Be warm and professional. If you do not know something, say so and offer to connect the visitor with the team.',
    'Never invent prices, policies or availability. Reply in the language the visitor uses (Bangla or English).',
  ]
    .filter(Boolean)
    .join('\n')
}

function roomNameFor(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `biz-${base || 'business'}-${Math.random().toString(36).slice(2, 8)}`
}

async function loadCreatorBusiness(userId: string): Promise<CreatorBusiness | null> {
  const workspace = await prismaClient.workspace.findUnique({
    where: { userId },
    select: {
      id: true,
      name: true,
      pitchMessage: true,
      onboardingStep: true,
      publishProfile: {
        select: {
          id: true,
          name: true,
          description: true,
          agents: {
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
            take: 1,
            select: { agent: { select: { id: true, roomName: true } } },
          },
        },
      },
    },
  })
  const profile = workspace?.publishProfile
  const agent = profile?.agents[0]?.agent
  if (!workspace || !profile || !agent) return null

  return {
    userId,
    workspaceId: workspace.id,
    publishProfileId: profile.id,
    name: profile.name || workspace.name,
    description: profile.description,
    pitchMessage: workspace.pitchMessage,
    agentId: agent.id,
    roomName: agent.roomName,
    // An unknown value never traps a creator in onboarding.
    onboardingStep: normalizeOnboardingStep(workspace.onboardingStep),
  }
}

/** Request-scoped (deduped within one render). Returns null until onboarding is complete. */
export const getCreatorBusiness = cache(loadCreatorBusiness)

/** Throws when the creator has no business — use in actions/routes that require one. */
export async function requireCreatorBusiness(userId: string): Promise<CreatorBusiness> {
  const business = await getCreatorBusiness(userId)
  if (!business) throw new Error('BUSINESS_NOT_FOUND')
  return business
}

/** Onboarding asks three things: name, type (a VERTICALS id) and location. */
export type CreateBusinessInput = { name: string; type?: string | null; location?: string | null }

/**
 * Creates profile + workspace + the one shared AI agent atomically.
 * Idempotent: if the creator already has a business, returns it.
 */
export async function createCreatorBusiness(
  userId: string,
  input: CreateBusinessInput,
): Promise<CreatorBusiness> {
  const existing = await loadCreatorBusiness(userId)
  if (existing) return existing

  const name = input.name.trim().slice(0, BUSINESS_NAME_MAX)
  if (!name) throw new Error('Business name is required')
  const vertical = VERTICALS.find((item) => item.id === input.type) ?? null
  const location = input.location?.trim().slice(0, LOCATION_MAX) || null
  // Type and location live in the business profile's site content (Services → Business edits them).
  const site = sanitizeSiteContent({ advanced: { vertical: vertical?.id ?? '', location: location ?? '' } }, name)
  const typeLabel = vertical && vertical.id !== 'other' ? vertical.label : null

  try {
    await prismaClient.$transaction(async (tx) => {
      const profile = await tx.publishProfile.create({
        data: { userId, name },
        select: { id: true },
      })
      await tx.workspace.create({
        data: {
          userId,
          name,
          publishProfileId: profile.id,
          pitchMessage: `Welcome to ${name}. Ask me anything about our services.`,
          videoType: VideoType.LINK,
          contextVertical: vertical?.id ?? null,
          contextCoreJson: { site } as unknown as Prisma.InputJsonObject,
          // New workspaces go through the rest of the setup guide.
          onboardingStep: 'agent',
        },
      })
      const agent = await tx.liveKitAgent.create({
        data: {
          userId,
          name: `${name} AI`,
          roomName: roomNameFor(name),
          firstMessage: `Hi! Welcome to ${name}. How can I help you today?`,
          systemPrompt: businessSystemPrompt(name, typeLabel, location),
          language: 'en',
          voiceProvider: DEFAULT_AGENT_ENGINE.voiceProvider,
          voiceModel: DEFAULT_AGENT_ENGINE.voiceModel,
          llmModel: DEFAULT_LLM_MODEL,
          llmProvider: 'google',
        },
        select: { id: true },
      })
      await tx.publishAgent.create({
        data: { publishProfileId: profile.id, agentId: agent.id, isPrimary: true },
      })
    })
  } catch (error) {
    // Concurrent onboarding submit — the unique userId constraint kept it to one business.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error
  }

  const created = await loadCreatorBusiness(userId)
  if (!created) throw new Error('Failed to create business')
  return created
}

/** Resolves the business that owns an AI room (used by the website SDK after session checks). */
export async function getBusinessByRoomName(roomName: string): Promise<CreatorBusiness | null> {
  const link = await prismaClient.publishAgent.findFirst({
    where: { agent: { roomName } },
    orderBy: { isPrimary: 'desc' },
    select: { publishProfile: { select: { userId: true } } },
  })
  const userId = link?.publishProfile.userId
  return userId ? getCreatorBusiness(userId) : null
}

/** Saves the setup step the creator is on, or null when they finish. */
export async function setOnboardingStep(workspaceId: string, step: OnboardingResumeStep | null): Promise<void> {
  await prismaClient.workspace.update({ where: { id: workspaceId }, data: { onboardingStep: step } })
}
