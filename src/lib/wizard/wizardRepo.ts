import 'server-only'
import { prismaClient } from '@/lib/prismaClient'
import type { CreatorBusiness } from '@/lib/business/creatorBusiness'
import { loadBusinessFacts, loadOfferFacts, offerTemplateSteps, templateSteps } from '@/lib/wizard/draftSteps'
import { clipVersion } from '@/lib/wizard/wizardAudio'
import {
  isWizardLanguage,
  isWizardShape,
  isWizardThemeId,
  sanitizeSteps,
  sanitizeWizardSettings,
  type PublicWizard,
  type WizardLanguage,
} from '@/lib/wizard/types'

const SLUG_MAX_BASE = 48

export function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_BASE)
  const suffix = Math.random().toString(36).slice(2, 7)
  return base ? `${base}-${suffix}` : `wizard-${suffix}`
}

export async function createWizardRecord(input: {
  userId: string
  name: string
  workspaceId: string | null
  language: WizardLanguage
  guideName?: string
}) {
  const guideName = input.guideName?.trim() || 'Nova'
  const facts = await loadBusinessFacts({ workspaceId: input.workspaceId, fallbackName: input.name })
  return prismaClient.voiceWizard.create({
    data: {
      userId: input.userId,
      workspaceId: input.workspaceId,
      name: input.name,
      guideName,
      language: input.language,
      slug: slugify(input.name),
      steps: templateSteps(facts, guideName, input.language),
    },
    select: { id: true, slug: true },
  })
}

export async function getWizardForOwner(slug: string, userId: string) {
  const wizard = await prismaClient.voiceWizard.findFirst({
    where: { slug, userId },
    include: { webinar: { select: { id: true, title: true, livekitAgentId: true } } },
  })
  if (!wizard) return null
  const agent = wizard.webinar?.livekitAgentId
    ? await prismaClient.liveKitAgent.findUnique({ where: { id: wizard.webinar.livekitAgentId }, select: { name: true } })
    : null
  return {
    id: wizard.id,
    slug: wizard.slug,
    name: wizard.name,
    guideName: wizard.guideName,
    language: isWizardLanguage(wizard.language) ? wizard.language : 'en',
    voice: wizard.voice,
    theme: isWizardThemeId(wizard.theme) ? wizard.theme : 'obsidian',
    shape: isWizardShape(wizard.shape) ? wizard.shape : 'circle',
    workspaceId: wizard.workspaceId,
    /** Set when this is a product's own tour. */
    webinarId: wizard.webinarId,
    /** The product this profile belongs to, and its AI agent (set in the product's settings). */
    product: wizard.webinar
      ? { id: wizard.webinar.id, title: wizard.webinar.title, agentName: agent?.name ?? null }
      : null,
    steps: sanitizeSteps(wizard.steps),
    settings: sanitizeWizardSettings(wizard.settings),
    isPublished: wizard.isPublished,
  } as const
}

/** Public tour payload. Unpublished wizards are only visible to their owner (preview). */
export async function getPublicWizard(slug: string, viewerUserId: string | null): Promise<PublicWizard | null> {
  const wizard = await prismaClient.voiceWizard.findUnique({
    where: { slug },
    select: {
      userId: true,
      slug: true,
      name: true,
      guideName: true,
      language: true,
      voice: true,
      theme: true,
      shape: true,
      steps: true,
      settings: true,
      isPublished: true,
      workspaceId: true,
    },
  })
  if (!wizard) return null
  if (!wizard.isPublished && wizard.userId !== viewerUserId) return null

  const language: WizardLanguage = isWizardLanguage(wizard.language) ? wizard.language : 'en'
  const facts = await loadBusinessFacts({ workspaceId: wizard.workspaceId, fallbackName: wizard.name })
  const steps = sanitizeSteps(wizard.steps)

  return {
    slug: wizard.slug,
    name: wizard.name,
    guideName: wizard.guideName,
    businessName: facts.businessName,
    language,
    theme: isWizardThemeId(wizard.theme) ? wizard.theme : 'obsidian',
    shape: isWizardShape(wizard.shape) ? wizard.shape : 'circle',
    steps: steps.map((step) => ({
      ...step,
      audioVersion: language === 'en' ? clipVersion(wizard.voice, step) : null,
    })),
    chatUrl: facts.chatUrl,
    isPublished: wizard.isPublished,
    settings: sanitizeWizardSettings(wizard.settings),
  }
}

/** Single-business model: each business has exactly one wizard, created on first visit. */
export async function getOrCreateBusinessWizard(business: CreatorBusiness) {
  const existing = await prismaClient.voiceWizard.findFirst({
    where: { userId: business.userId, webinarId: null },
    orderBy: { createdAt: 'asc' },
    select: { slug: true },
  })
  const slug =
    existing?.slug ??
    (
      await createWizardRecord({
        userId: business.userId,
        name: `${business.name} tour`,
        workspaceId: business.workspaceId,
        language: 'en',
      })
    ).slug
  const wizard = await getWizardForOwner(slug, business.userId)
  if (!wizard) throw new Error('WIZARD_NOT_FOUND')
  return wizard
}

/**
 * A product's own wizard profile: created with the product (and for older products the first
 * time it is needed), with fresh steps about the product. The product's AI agent sets the default
 * language; guide, voice and look start from the business tour so they match. Everything except
 * the agent can then be changed in Services → Wizard. Returns the slug, or null if not the owner's.
 */
export async function ensureOfferTour(input: { webinarId: string; userId: string }): Promise<string | null> {
  const existing = await prismaClient.voiceWizard.findUnique({
    where: { webinarId: input.webinarId },
    select: { slug: true, userId: true },
  })
  if (existing) return existing.userId === input.userId ? existing.slug : null

  const [offer, offerRow, businessTour] = await Promise.all([
    loadOfferFacts(input.webinarId),
    prismaClient.webinar.findFirst({
      where: { id: input.webinarId, presenterId: input.userId, deletedAt: null },
      select: { title: true, workspaceId: true, livekitAgentId: true },
    }),
    prismaClient.voiceWizard.findFirst({
      where: { userId: input.userId, webinarId: null },
      orderBy: { createdAt: 'asc' },
      select: { guideName: true, voice: true, theme: true, shape: true, language: true, workspaceId: true },
    }),
  ])
  if (!offer || !offerRow) return null

  const agent = offerRow.livekitAgentId
    ? await prismaClient.liveKitAgent.findUnique({ where: { id: offerRow.livekitAgentId }, select: { language: true } })
    : null
  const language: WizardLanguage = agent?.language?.toLowerCase().startsWith('bn')
    ? 'bn'
    : isWizardLanguage(businessTour?.language) ? businessTour.language : 'en'
  const guideName = businessTour?.guideName || 'Nova'
  try {
    const created = await prismaClient.voiceWizard.create({
      data: {
        userId: input.userId,
        workspaceId: offerRow.workspaceId ?? businessTour?.workspaceId ?? null,
        webinarId: input.webinarId,
        name: `${offerRow.title} tour`.slice(0, 255),
        guideName,
        language,
        ...(businessTour ? { voice: businessTour.voice, theme: businessTour.theme, shape: businessTour.shape } : {}),
        slug: slugify(offerRow.title),
        steps: offerTemplateSteps(offer, guideName, language),
      },
      select: { slug: true },
    })
    return created.slug
  } catch {
    // Created by a parallel request (webinarId is unique): use that one.
    const raced = await prismaClient.voiceWizard.findUnique({ where: { webinarId: input.webinarId }, select: { slug: true } })
    return raced?.slug ?? null
  }
}

/** Same as ensureOfferTour, but never throws: product creation must not fail over its tour. */
export async function ensureOfferTourQuietly(input: { webinarId: string; userId: string }): Promise<void> {
  try {
    await ensureOfferTour(input)
  } catch (error) {
    console.warn('[wizard] could not create the product tour', input.webinarId, error)
  }
}

export type WizardProfile = {
  /** null for the business tour. */
  webinarId: string | null
  label: string
  isPublished: boolean
}

/** The business tour plus one profile per product, for the profile switcher in Services → Wizard. */
export async function listWizardProfiles(userId: string): Promise<WizardProfile[]> {
  const [business, products] = await Promise.all([
    prismaClient.voiceWizard.findFirst({
      where: { userId, webinarId: null },
      orderBy: { createdAt: 'asc' },
      select: { isPublished: true },
    }),
    prismaClient.webinar.findMany({
      where: { presenterId: userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, title: true, tour: { select: { isPublished: true } } },
    }),
  ])
  return [
    { webinarId: null, label: 'Business', isPublished: business?.isPublished ?? false },
    ...products.map((product) => ({
      webinarId: product.id,
      label: product.title,
      isPublished: product.tour?.isPublished ?? false,
    })),
  ]
}
