import 'server-only'
import { cache } from 'react'
import { Prisma, VideoType } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { DEFAULT_LLM_MODEL } from '@/lib/llm/defaultModel'

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
}

const BUSINESS_NAME_MAX = 120
const DESCRIPTION_MAX = 500

function businessSystemPrompt(name: string, description: string | null): string {
  return [
    `You are the AI assistant for ${name}.`,
    description ? `About the business: ${description}` : null,
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

export type CreateBusinessInput = { name: string; description?: string | null }

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
  const description = input.description?.trim().slice(0, DESCRIPTION_MAX) || null

  try {
    await prismaClient.$transaction(async (tx) => {
      const profile = await tx.publishProfile.create({
        data: { userId, name, description },
        select: { id: true },
      })
      await tx.workspace.create({
        data: {
          userId,
          name,
          publishProfileId: profile.id,
          pitchMessage: `Welcome to ${name}. Ask me anything about our services.`,
          videoType: VideoType.LINK,
        },
      })
      const agent = await tx.liveKitAgent.create({
        data: {
          userId,
          name: `${name} AI`,
          roomName: roomNameFor(name),
          firstMessage: `Hi! Welcome to ${name}. How can I help you today?`,
          systemPrompt: businessSystemPrompt(name, description),
          language: 'en',
          voiceProvider: 'deepgram',
          voiceModel: 'aura-asteria-en',
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
