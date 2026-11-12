'use server'

import { revalidatePath } from 'next/cache'
import { onAuthenticateUser } from '@/actions/auth'
import { prismaClient } from '@/lib/prismaClient'
import { draftStepsWithAi } from '@/lib/wizard/draftSteps'
import { getWizardForOwner } from '@/lib/wizard/wizardRepo'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'
import { PAID_ACCESS_ERROR, userHasPaidAccess } from '@/lib/billing/paidAccess'
import { pregenerateClips, pruneStaleClips } from '@/lib/wizard/wizardAudio'
import {
  WIZARD_LIMITS,
  isWizardLanguage,
  isWizardShape,
  isWizardThemeId,
  isWizardVoice,
  sanitizeSteps,
  type VoiceWizardStep,
  type WizardLanguage,
  type WizardShape,
  type WizardThemeId,
} from '@/lib/wizard/types'

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string }

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
    },
  })
  await pruneStaleClips(existing.id, voice, steps)

  revalidatePath('/messages/wizard')
  revalidatePath(`/wizard/${slug}`)
  revalidatePath(`/messages/wizard/${slug}`)
  return { ok: true, steps }
}

export async function setVoiceWizardPublished(
  slug: string,
  published: boolean,
): Promise<ActionResult<{ audioFailures: number }>> {
  const userId = await requireUserId()
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' }
  const wizard = await getWizardForOwner(slug, userId)
  if (!wizard) return { ok: false, error: 'Wizard not found' }
  if (published && wizard.steps.length === 0) return { ok: false, error: 'Add steps before publishing' }
  if (published && !(await userHasPaidAccess(userId))) return { ok: false, error: PAID_ACCESS_ERROR }

  // Pre-render narration so the first visitor gets instant audio (English / Deepgram only).
  const { failed } =
    published && wizard.language === 'en'
      ? await pregenerateClips(wizard.id, userId, wizard.voice, wizard.steps)
      : { failed: 0 }

  await prismaClient.voiceWizard.update({
    where: { id: wizard.id },
    data: { isPublished: published, publishedAt: published ? new Date() : null },
  })
  revalidatePath('/messages/wizard')
  revalidatePath(`/wizard/${slug}`)
  revalidatePath(`/messages/wizard/${slug}`)
  return { ok: true, audioFailures: failed }
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
  })
  return { ok: true, ...draft }
}

