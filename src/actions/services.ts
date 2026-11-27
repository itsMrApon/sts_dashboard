'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { onAuthenticateUser } from '@/actions/auth'
import { prismaClient } from '@/lib/prismaClient'
import { getCreatorBusiness, type CreatorBusiness } from '@/lib/business/creatorBusiness'
import { SERVICE_KIND, getBusinessServices, saveServiceConfig } from '@/lib/services/serviceConfig'
import { LOOK_KEYS, splitServiceConfig } from '@/lib/agents/assistantServices'
import { submitBusinessForm } from '@/lib/services/formSubmit'
import { PAID_ACCESS_ERROR, userCanGoLive } from '@/lib/billing/paidAccess'
import { getWebsiteConnection } from '@/lib/embed/websiteConnection'
import { WEBSITE_REQUIRED_ERROR } from '@/lib/embed/websiteConnectionShared'
import { siteContentFromLegacy } from '@/lib/business/siteContent'
import { decryptToken } from '@/lib/messages/encrypt'
import { generateReply } from '@/lib/messages/geminiText'
import { getUserVoiceCredentialByUserId } from '@/lib/voiceCredentialsRepo'
import { ensureAgentEditAccess } from '@/lib/agents/agentAccess'
import { FORM_DRAFT_BRIEF } from '@/lib/agents/assistantDraft'
import {
  DEFAULT_FORM_CONFIG,
  sanitizeChatConfig,
  sanitizeFormConfig,
  sanitizeSpeakConfig,
  type ChatServiceConfig,
  type FormAnswers,
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
  return enabled && !(await userCanGoLive(business.userId))
}

type LookService = 'chat' | 'voice' | 'form'
type LookConfig = { chat: ChatServiceConfig; voice: SpeakServiceConfig; form: FormServiceConfig }

/**
 * Services page save: the switch and the looks only. Behaviour (greeting, questions, call length…)
 * belongs to the service's assistant and is saved from AI Agents. A service can't go live
 * without an assistant.
 */
export async function saveServiceLook<S extends LookService>(input: {
  service: S
  enabled: boolean
  look: Partial<LookConfig[S]>
}): Promise<ActionResult<{ config: LookConfig[S]; enabled: boolean }>> {
  const business = await myBusiness()
  if (!business) return { ok: false, error: 'UNAUTHENTICATED' }
  if (!['chat', 'voice', 'form'].includes(input.service)) return { ok: false, error: 'Unknown service' }
  const enabled = Boolean(input.enabled)
  if (await blockedFromGoingLive(business, enabled)) return { ok: false, error: PAID_ACCESS_ERROR }

  const kind = SERVICE_KIND[input.service]
  const row = await prismaClient.serviceConfig.findUnique({
    where: { workspaceId_kind: { workspaceId: business.workspaceId, kind } },
    select: { config: true },
  })
  const current = await getBusinessServices(business.workspaceId)
  const slot = input.service === 'chat' ? current.chat : input.service === 'voice' ? current.speak : current.form
  if (enabled && !slot.agent) return { ok: false, error: 'Pick an assistant for this service first.' }
  // Going live the first time needs the website connection (one connection covers every service).
  if (enabled && !slot.enabled && !(await getWebsiteConnection(business.roomName)).connected) {
    return { ok: false, error: WEBSITE_REQUIRED_ERROR }
  }

  // Only look keys are taken from the input; behaviour fallbacks already on the row are kept.
  const lookKeys: readonly string[] = LOOK_KEYS[input.service]
  const rawLook = Object.fromEntries(Object.entries(input.look ?? {}).filter(([key]) => lookKeys.includes(key)))
  const sanitize = input.service === 'chat' ? sanitizeChatConfig : input.service === 'voice' ? sanitizeSpeakConfig : sanitizeFormConfig
  const cleanLook = splitServiceConfig(sanitize({ ...slot.config, ...rawLook }), lookKeys).look
  const stored = { ...(row?.config && typeof row.config === 'object' && !Array.isArray(row.config) ? row.config : {}), ...cleanLook }
  delete (stored as Record<string, unknown>).agentId
  await saveServiceConfig(business.workspaceId, kind, enabled, stored as Prisma.InputJsonObject)
  revalidatePath('/services', 'layout')

  const saved = await getBusinessServices(business.workspaceId)
  const next = input.service === 'chat' ? saved.chat : input.service === 'voice' ? saved.speak : saved.form
  return { ok: true, config: next.config as LookConfig[S], enabled: next.enabled }
}

/** Dashboard "try it" submit: uses the saved form config and really emails it (nothing is stored). */
export async function submitFormPreview(input: {
  values: FormAnswers
  consent: boolean
}): Promise<{ ok: true; message: string } | { ok: false; error: string; fieldId?: string }> {
  const business = await myBusiness()
  if (!business) return { ok: false, error: 'UNAUTHENTICATED' }
  const services = await getBusinessServices(business.workspaceId)
  const result = await submitBusinessForm({
    ownerUserId: business.userId,
    workspaceId: business.workspaceId,
    businessName: business.name,
    config: services.form.config,
    values: input.values,
    consent: input.consent,
    source: 'preview',
  })
  return result.ok ? { ok: true, message: result.message } : { ok: false, error: result.error, fieldId: result.fieldId }
}

/** Projects/products the shared AI can mention (links shown in chat replies). */
/**
 * Adds and removes offers on the business (the Business → Products & projects picker). Only the
 * changes are sent, so an offer created after the picker loaded (on the business by default) is
 * never dropped by a stale save. The oldest link becomes Featured when none is.
 */
export async function setBusinessProducts(input: { add: string[]; remove: string[] }): Promise<ActionResult> {
  const auth = await onAuthenticateUser()
  if (!auth.user) return { ok: false, error: 'UNAUTHENTICATED' }
  const business = await getCreatorBusiness(auth.user.id)
  if (!business) return { ok: false, error: 'Create your business first' }

  const add = Array.isArray(input?.add) ? input.add.slice(0, 50) : []
  const remove = Array.isArray(input?.remove) ? input.remove.slice(0, 50) : []
  const owned = await prismaClient.webinar.findMany({
    where: { id: { in: add }, presenterId: auth.user.id, deletedAt: null },
    select: { id: true },
  })
  const publishProfileId = business.publishProfileId

  await prismaClient.$transaction(async (tx) => {
    await tx.publishProduct.deleteMany({ where: { publishProfileId, webinarId: { in: remove } } })
    await tx.publishProduct.createMany({
      data: owned.map((webinar) => ({ publishProfileId, webinarId: webinar.id, isPrimary: false })),
      skipDuplicates: true,
    })
    const hasPrimary = await tx.publishProduct.count({ where: { publishProfileId, isPrimary: true } })
    if (!hasPrimary) {
      const first = await tx.publishProduct.findFirst({ where: { publishProfileId }, orderBy: { createdAt: 'asc' } })
      if (first) await tx.publishProduct.update({ where: { id: first.id }, data: { isPrimary: true } })
    }
  })
  revalidatePath('/services', 'layout')
  revalidateTag('projects-list')
  return { ok: true }
}


/** "Let AI build it": drafts the form from the business details, its services and this assistant's prompt. Nothing is saved. */
export async function draftFormWithAI(agentId: string): Promise<
  | {
      ok: true
      draft: Pick<FormServiceConfig, 'title' | 'description' | 'submitLabel' | 'successMessage' | 'fields'>
    }
  | { ok: false; error: string }
> {
  const business = await myBusiness()
  if (!business) return { ok: false, error: 'UNAUTHENTICATED' }
  const access = await ensureAgentEditAccess(agentId, business.userId)
  if (!access.ok) return { ok: false, error: 'Assistant not found' }

  const [agent, workspace, credential] = await Promise.all([
    prismaClient.liveKitAgent.findUnique({
      where: { id: access.agentId },
      select: { name: true, systemPrompt: true, language: true },
    }),
    prismaClient.workspace.findUnique({
      where: { id: business.workspaceId },
      select: { contextVertical: true, contextCoreJson: true, contextIndustryJson: true, contextSocialJson: true },
    }),
    getUserVoiceCredentialByUserId(business.userId),
  ])

  let apiKey: string | null = null
  try {
    apiKey = decryptToken(credential?.googleApiKey) || null
  } catch {
    apiKey = null
  }

  const site = workspace
    ? siteContentFromLegacy({
        businessName: business.name,
        vertical: workspace.contextVertical,
        core: workspace.contextCoreJson,
        industry: workspace.contextIndustryJson,
        social: workspace.contextSocialJson,
      })
    : null

  const result = await generateReply({
    userMessage: JSON.stringify({
      businessName: business.name,
      description: business.description,
      vertical: site?.advanced.vertical || null,
      services: (site?.services ?? [])
        .filter((service) => service.active)
        .slice(0, 12)
        .map((service) => ({ name: service.name, category: service.category, summary: service.summary })),
      agentName: agent?.name ?? null,
      // The agent prompt says what the business sells and how it talks: the form should match.
      agentPrompt: agent?.systemPrompt?.slice(0, 4000) ?? null,
      language: agent?.language === 'bn' ? 'Bangla' : 'English',
    }),
    history: [],
    systemPrompt: [
      'You build web forms for small businesses. Use only the facts given.',
      'Write all text in the requested language (Bangla stays in Bangla script). Return ONLY minified JSON, no prose.',
      FORM_DRAFT_BRIEF,
    ].join('\n'),
    apiKey,
    accountUserId: business.userId,
    usageSurface: 'messages',
  })
  if (!result.ok) return { ok: false, error: result.error }

  const start = result.text.indexOf('{')
  const end = result.text.lastIndexOf('}')
  let parsed: Record<string, unknown>
  try {
    parsed = start >= 0 && end > start ? (JSON.parse(result.text.slice(start, end + 1)) as Record<string, unknown>) : {}
  } catch {
    return { ok: false, error: 'AI returned an unreadable draft. Try again.' }
  }
  if (!Array.isArray(parsed.fields) || parsed.fields.length === 0) {
    return { ok: false, error: 'AI did not suggest any questions. Try again.' }
  }

  // Same sanitizer as Save: clamps lengths, drops unknown types, gives every question an id.
  const config = sanitizeFormConfig({
    ...DEFAULT_FORM_CONFIG,
    ...parsed,
    fields: (parsed.fields as unknown[]).map((field) => ({ ...(field && typeof field === 'object' ? field : {}), id: '' })),
  })
  const { title, description, submitLabel, successMessage, fields } = config
  return { ok: true, draft: { title, description, submitLabel, successMessage, fields } }
}
