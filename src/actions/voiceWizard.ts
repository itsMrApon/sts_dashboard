'use server'

import { revalidatePath } from 'next/cache'
import { onAuthenticateUser } from '@/actions/auth'
import { prismaClient } from '@/lib/prismaClient'
import { draftStepsWithAi, loadOfferFacts } from '@/lib/wizard/draftSteps'
import { getWizardForOwner } from '@/lib/wizard/wizardRepo'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'
import { getBusinessServices } from '@/lib/services/serviceConfig'
import { PAID_ACCESS_ERROR, userCanGoLive } from '@/lib/billing/paidAccess'
import { getWebsiteConnection } from '@/lib/embed/websiteConnection'
import { WEBSITE_REQUIRED_ERROR } from '@/lib/embed/websiteConnectionShared'
import { pregenerateClips, pruneStaleClips } from '@/lib/wizard/wizardAudio'
import {
  WIZARD_LIMITS,
  isWizardLanguage,
  isWizardShape,
  isWizardThemeId,
  isWizardVoice,
  sanitizeSteps,
  sanitizeWizardSettings,
  type VoiceWizardStep,
  type WizardSettings,
  type WizardLanguage,
  type WizardShape,
  type WizardThemeId,
} from '@/lib/wizard/types'

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string }

function revalidateWizard(slug: string, webinarId: string | null) {
  revalidatePath(`/wizard/${slug}`)
  revalidatePath('/services/wizard')
  if (webinarId) {
    // A product's own profile: its settings and share page.
    revalidatePath(`/projects/${webinarId}`)
    revalidatePath('/o/[slug]', 'page')
  }
}

async function requireUserId(): Promise<string | null> {
  const auth = await onAuthenticateUser()
  return auth.user?.id ?? null
}

export type VoiceWizardUpdate = {
  name: string
  guideName: string
  language: WizardLanguage
  voice: string
  theme: WizardThemeId
  shape: WizardShape
  steps: VoiceWizardStep[]
  settings: WizardSettings
}

export async function updateVoiceWizard(
  slug: string,
  input: VoiceWizardUpdate,
): Promise<ActionResult<{ steps: VoiceWizardStep[] }>> {
  const userId = await requireUserId()
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' }
  const existing = await getWizardForOwner(slug, userId)
  if (!existing) return { ok: false, error: 'Wizard not found' }

  const name = input.name?.trim().slice(0, WIZARD_LIMITS.name)
  if (!name) return { ok: false, error: 'Wizard name is required' }
  const business = await getCreatorBusiness(userId)
  const workspaceId = business?.workspaceId ?? null

  const steps = sanitizeSteps(input.steps)
  if (steps.length === 0) return { ok: false, error: 'Add at least one step with text' }
  const voice = isWizardVoice(input.voice) ? input.voice : existing.voice

  await prismaClient.voiceWizard.update({
    where: { id: existing.id },
    data: {
      name,
      guideName: input.guideName?.trim().slice(0, WIZARD_LIMITS.guideName) || 'Nova',
      workspaceId,
      language: isWizardLanguage(input.language) ? input.language : existing.language,
      voice,
      theme: isWizardThemeId(input.theme) ? input.theme : existing.theme,
      shape: isWizardShape(input.shape) ? input.shape : existing.shape,
      steps,
      settings: sanitizeWizardSettings(input.settings),
    },
  })
  await pruneStaleClips(existing.id, voice, steps)

  revalidateWizard(slug, existing.webinarId)
  return { ok: true, steps }
}

export async function setVoiceWizardPublished(
  slug: string,
  published: boolean,
): Promise<ActionResult<{ audioFailures: number; audioKeyMissing: boolean }>> {
  const userId = await requireUserId()
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' }
  const wizard = await getWizardForOwner(slug, userId)
  if (!wizard) return { ok: false, error: 'Wizard not found' }
  if (published && wizard.steps.length === 0) return { ok: false, error: 'Add steps before publishing' }
  if (published && !(await userCanGoLive(userId))) return { ok: false, error: PAID_ACCESS_ERROR }
  // The business tour needs its Tour assistant (product tours use the product's own agent).
  if (published && !wizard.webinarId) {
    const business = await getCreatorBusiness(userId)
    const tour = business ? (await getBusinessServices(business.workspaceId)).tour : null
    if (!tour?.agent) return { ok: false, error: 'Pick a Tour assistant first (AI Agents → New assistant → Tour).' }
    if (!wizard.isPublished && business && !(await getWebsiteConnection(business.roomName)).connected) {
      return { ok: false, error: WEBSITE_REQUIRED_ERROR }
    }
  }

  // Pre-render narration so the first visitor gets instant audio (English / Cartesia only).
  const { failed, missingKey } =
    published && wizard.language === 'en'
      ? await pregenerateClips(wizard.id, userId, wizard.voice, wizard.steps)
      : { failed: 0, missingKey: false }

  await prismaClient.voiceWizard.update({
    where: { id: wizard.id },
    data: { isPublished: published, publishedAt: published ? new Date() : null },
  })
  revalidateWizard(slug, wizard.webinarId)
  return { ok: true, audioFailures: failed, audioKeyMissing: missingKey }
}

export async function draftVoiceWizardSteps(input: {
  slug: string
  name: string
  guideName: string
  language: WizardLanguage
}): Promise<ActionResult<{ steps: VoiceWizardStep[]; source: 'ai' | 'template'; note?: string }>> {
  const userId = await requireUserId()
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' }
  const wizard = await getWizardForOwner(input.slug, userId)
  if (!wizard) return { ok: false, error: 'Wizard not found' }
  const business = await getCreatorBusiness(userId)
  const workspaceId = business?.workspaceId ?? null

  const draft = await draftStepsWithAi({
    userId,
    workspaceId,
    wizardName: input.name?.trim() || wizard.name,
    guideName: input.guideName?.trim() || wizard.guideName,
    language: isWizardLanguage(input.language) ? input.language : wizard.language,
    offer: wizard.webinarId ? await loadOfferFacts(wizard.webinarId) : null,
    guideBrief:
      !wizard.webinarId && workspaceId ? (await getBusinessServices(workspaceId)).tour.agent?.systemPrompt ?? null : null,
  })
  return { ok: true, ...draft }
}

