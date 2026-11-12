'use server'

import { revalidatePath } from 'next/cache'
import { WebServiceKind } from '@prisma/client'
import { onAuthenticateUser } from '@/actions/auth'
import { prismaClient } from '@/lib/prismaClient'
import { getCreatorBusiness, type CreatorBusiness } from '@/lib/business/creatorBusiness'
import { getBusinessServices, saveServiceConfig } from '@/lib/services/serviceConfig'
import { submitBusinessForm } from '@/lib/services/formSubmit'
import { PAID_ACCESS_ERROR, userHasPaidAccess } from '@/lib/billing/paidAccess'
import {
  sanitizeChatConfig,
  sanitizeFormConfig,
  sanitizeSpeakConfig,
  type ChatServiceConfig,
  type FormServiceConfig,
  type SpeakServiceConfig,
} from '@/lib/services/types'

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string }

async function myBusiness(): Promise<CreatorBusiness | null> {
  const auth = await onAuthenticateUser()
  if (!auth.user) return null
  return getCreatorBusiness(auth.user.id)
}

/** Saving a draft is free; switching a service on needs a package. */
async function blockedFromGoingLive(business: CreatorBusiness, enabled: boolean): Promise<boolean> {
  return enabled && !(await userHasPaidAccess(business.userId))
}

export async function saveChatService(input: {
  enabled: boolean
  config: ChatServiceConfig
}): Promise<ActionResult<{ config: ChatServiceConfig }>> {
  const business = await myBusiness()
  if (!business) return { ok: false, error: 'UNAUTHENTICATED' }
  if (await blockedFromGoingLive(business, Boolean(input.enabled))) return { ok: false, error: PAID_ACCESS_ERROR }
  const config = sanitizeChatConfig(input.config)
  await saveServiceConfig(business.workspaceId, WebServiceKind.CHAT, Boolean(input.enabled), config)
  revalidatePath('/messages', 'layout')
  return { ok: true, config }
}

const SPEAK_LANGUAGES = new Set(['en', 'bn'])
const FIRST_LINE_MAX = 500

/**
 * Speak AI: language and first line live on the shared agent (read by the Python worker).
 * The voice is account-wide (AI Agents → Config), so it is not written here.
 */
export async function saveSpeakService(input: {
  enabled: boolean
  config: SpeakServiceConfig
  language: string
  firstMessage: string
}): Promise<ActionResult<{ config: SpeakServiceConfig }>> {
  const business = await myBusiness()
  if (!business) return { ok: false, error: 'UNAUTHENTICATED' }
  if (await blockedFromGoingLive(business, Boolean(input.enabled))) return { ok: false, error: PAID_ACCESS_ERROR }

  const config = sanitizeSpeakConfig(input.config)
  const language = SPEAK_LANGUAGES.has(input.language) ? input.language : 'en'
  const firstMessage = input.firstMessage?.trim().slice(0, FIRST_LINE_MAX) || null

  await Promise.all([
    saveServiceConfig(business.workspaceId, WebServiceKind.SPEAK, Boolean(input.enabled), config),
    prismaClient.liveKitAgent.update({
      where: { id: business.agentId },
      data: { language, firstMessage },
    }),
  ])
  revalidatePath('/messages', 'layout')
  return { ok: true, config }
}

export async function saveFormService(input: {
  enabled: boolean
  config: FormServiceConfig
}): Promise<ActionResult<{ config: FormServiceConfig }>> {
  const business = await myBusiness()
  if (!business) return { ok: false, error: 'UNAUTHENTICATED' }
  if (await blockedFromGoingLive(business, Boolean(input.enabled))) return { ok: false, error: PAID_ACCESS_ERROR }
  const config = sanitizeFormConfig(input.config)
  await saveServiceConfig(business.workspaceId, WebServiceKind.FORM, Boolean(input.enabled), config)
  revalidatePath('/messages', 'layout')
  return { ok: true, config }
}

/** Dashboard "try it" submit — uses the saved form config, stored with source "preview". */
export async function submitFormPreview(input: {
  values: Record<string, string>
  consent: boolean
}): Promise<ActionResult<{ message: string; emailed: boolean }>> {
  const business = await myBusiness()
  if (!business) return { ok: false, error: 'UNAUTHENTICATED' }
  const services = await getBusinessServices(business.workspaceId)
  const result = await submitBusinessForm({
    workspaceId: business.workspaceId,
    ownerUserId: business.userId,
    businessName: business.name,
    config: services.form.config,
    values: input.values,
    consent: input.consent,
    source: 'preview',
  })
  if (!result.ok) return { ok: false, error: result.error }
  revalidatePath('/messages/form')
  return { ok: true, message: result.message, emailed: result.emailed }
}

export async function deleteFormSubmission(id: string): Promise<ActionResult> {
  const business = await myBusiness()
  if (!business) return { ok: false, error: 'UNAUTHENTICATED' }
  await prismaClient.formSubmission.deleteMany({ where: { id, workspaceId: business.workspaceId } })
  revalidatePath('/messages/form')
  return { ok: true }
}

/** Projects/products the shared AI can mention (links shown in chat replies). */
export async function setBusinessProducts(webinarIds: string[]): Promise<ActionResult> {
  const auth = await onAuthenticateUser()
  if (!auth.user) return { ok: false, error: 'UNAUTHENTICATED' }
  const business = await getCreatorBusiness(auth.user.id)
  if (!business) return { ok: false, error: 'Create your business first' }

  const owned = await prismaClient.webinar.findMany({
    where: { id: { in: webinarIds.slice(0, 50) }, presenterId: auth.user.id },
    select: { id: true },
  })
  await prismaClient.$transaction([
    prismaClient.publishProduct.deleteMany({ where: { publishProfileId: business.publishProfileId } }),
    prismaClient.publishProduct.createMany({
      data: owned.map((webinar, index) => ({
        publishProfileId: business.publishProfileId,
        webinarId: webinar.id,
        isPrimary: index === 0,
      })),
    }),
  ])
  revalidatePath('/messages', 'layout')
  return { ok: true }
}
