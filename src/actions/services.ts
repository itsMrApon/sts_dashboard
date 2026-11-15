'use server'

import { revalidatePath } from 'next/cache'
import { WebServiceKind } from '@prisma/client'
import { onAuthenticateUser } from '@/actions/auth'
import { prismaClient } from '@/lib/prismaClient'
import { getCreatorBusiness, type CreatorBusiness } from '@/lib/business/creatorBusiness'
import { getBusinessServices, saveServiceConfig } from '@/lib/services/serviceConfig'
import { submitBusinessForm } from '@/lib/services/formSubmit'
import { PAID_ACCESS_ERROR, userHasPaidAccess } from '@/lib/billing/paidAccess'
import { siteContentFromLegacy } from '@/lib/business/siteContent'
import { decryptToken } from '@/lib/messages/encrypt'
import { generateReply } from '@/lib/messages/geminiText'
import { getUserVoiceCredentialByUserId } from '@/lib/voiceCredentialsRepo'
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
    businessName: business.name,
    config: services.form.config,
    values: input.values,
    consent: input.consent,
    source: 'preview',
  })
  return result.ok ? { ok: true, message: result.message } : { ok: false, error: result.error, fieldId: result.fieldId }
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

const FORM_DRAFT_BRIEF = [
  'Design a short lead form for this business that a visitor fills in one question at a time (Typeform style).',
  'Return JSON: {"title","description","submitLabel","successMessage","fields":[{"label","type","required","options","multiple","scale","placeholder","helpText"}]}.',
  'type is one of: text, textarea, email, phone, number, url, date, select, yesno, rating.',
  '- 4 to 7 questions. Ask for the name first, then at least one way to reply (phone and/or email, required).',
  '- Write each label as a friendly question ("What\'s your name?"). helpText is optional and short.',
  '- Use select (with 2–8 options) for things like which service they need; take options from the services list when given. multiple=true only when several answers make sense.',
  '- Use date for a preferred day, yesno for simple yes/no, rating only when it fits; scale is 5 (stars) or 10.',
  '- placeholder only for text/textarea/email/phone/number/url; otherwise "".',
  '- title is short (under 60 characters); description is one sentence; successMessage thanks the visitor.',
  '- Never invent prices, addresses or promises that are not in the facts given.',
].join('\n')

/** "Build with AI": drafts the form from the business details, services and agent prompt. Nothing is saved. */
export async function draftFormWithAI(): Promise<
  | {
      ok: true
      draft: Pick<FormServiceConfig, 'title' | 'description' | 'submitLabel' | 'successMessage' | 'fields'>
    }
  | { ok: false; error: string }
> {
  const business = await myBusiness()
  if (!business) return { ok: false, error: 'UNAUTHENTICATED' }

  const [agent, workspace, credential] = await Promise.all([
    prismaClient.liveKitAgent.findUnique({
      where: { id: business.agentId },
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
