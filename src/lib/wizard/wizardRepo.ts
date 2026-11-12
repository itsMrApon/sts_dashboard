import 'server-only'
import { prismaClient } from '@/lib/prismaClient'
import type { CreatorBusiness } from '@/lib/business/creatorBusiness'
import { loadBusinessFacts, templateSteps } from '@/lib/wizard/draftSteps'
import { clipVersion } from '@/lib/wizard/wizardAudio'
import {
  isWizardLanguage,
  isWizardShape,
  isWizardThemeId,
  sanitizeSteps,
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
  })
  if (!wizard) return null
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
    steps: sanitizeSteps(wizard.steps),
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
  }
}

/** Single-business model: each business has exactly one wizard, created on first visit. */
export async function getOrCreateBusinessWizard(business: CreatorBusiness) {
  const existing = await prismaClient.voiceWizard.findFirst({
    where: { userId: business.userId },
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
