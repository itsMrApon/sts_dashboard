'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { OrderModeKind, WebinarStatusEnum, type Prisma, type User, type WebinarKind } from '@prisma/client'
import { onAuthenticateUser } from '@/actions/auth'
import { prismaClient } from '@/lib/prismaClient'
import { ensureOfferTourQuietly } from '@/lib/wizard/wizardRepo'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'
import { PAID_ACCESS_ERROR } from '@/lib/billing/paidAccess'
import { buildOfferSlug } from '@/lib/offers/offerModel'
import {
  agentVisibleTo,
  defaultOrderModes,
  legacyLinkFields,
  toWebinarKind,
  validatePricing,
  writePricing,
} from '@/lib/offers/offerSettings'
import {
  AI_SERVICES,
  ORDER_MODE_KINDS,
  type AiService,
  type OfferKindInput,
  type OfferPricingInput,
  type OrderModesInput,
} from '@/lib/offers/offerTypes'

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const TITLE_MAX = 255
const DESCRIPTION_MAX = 2000

type Owner =
  | { error: string }
  | {
      user: User
      webinar: { id: string; kind: WebinarKind; startTime: Date; webinarStatus: WebinarStatusEnum } | null
    }

/** Loads the signed-in creator and, when given, an offer they own. Every write needs a package. */
async function requireOwner(webinarId?: string): Promise<Owner> {
  const auth = await onAuthenticateUser()
  if (!auth.user) return { error: 'Please sign in again' }
  if (!auth.user.subscription) return { error: PAID_ACCESS_ERROR }
  if (!webinarId) return { user: auth.user, webinar: null }
  const webinar = await prismaClient.webinar.findFirst({
    where: { id: webinarId, presenterId: auth.user.id, deletedAt: null },
    select: { id: true, kind: true, startTime: true, webinarStatus: true },
  })
  if (!webinar) return { error: 'Offer not found' }
  return { user: auth.user, webinar }
}

function revalidateOffer(webinarId: string) {
  revalidatePath('/projects')
  revalidatePath(`/projects/${webinarId}`)
  revalidatePath(`/projects/${webinarId}/pipeline`)
  revalidateTag('projects-list')
}

/** "+ Add service" → Product / Webinar: a ready-to-edit offer that opens on its settings page. */
export async function createOffer(input: { kind: OfferKindInput; title: string }): Promise<ActionResult<{ id: string }>> {
  const owner = await requireOwner()
  if ('error' in owner) return { ok: false, error: owner.error }
  const title = input.title?.trim().slice(0, TITLE_MAX)
  if (!title) return { ok: false, error: 'Give it a name' }
  if (input.kind !== 'PRODUCT' && input.kind !== 'WEBINAR') return { ok: false, error: 'Unknown offer type' }

  const business = await getCreatorBusiness(owner.user.id)
  const kind = toWebinarKind(input.kind)
  const modes = defaultOrderModes(input.kind, !!business?.agentId)

  // Webinars need a future time; default to tomorrow 10:00 server time, editable on the settings page.
  const startTime = new Date()
  if (input.kind === 'WEBINAR') {
    startTime.setDate(startTime.getDate() + 1)
    startTime.setHours(10, 0, 0, 0)
  }

  const webinar = await prismaClient.webinar.create({
    data: {
      title,
      kind,
      startTime,
      presenterId: owner.user.id,
      workspaceId: business?.workspaceId ?? null,
      livekitAgentId: business?.agentId ?? null,
      slug: buildOfferSlug(title),
      tags: [],
      ...legacyLinkFields(kind, modes),
      orderModes: {
        create: ORDER_MODE_KINDS.map((modeKind) => ({ kind: modeKind, enabled: modes[modeKind] })),
      },
    },
    select: { id: true },
  })
  // On the business by default, so the business AI can recommend it right away (Settings → "Show on
  // my business" turns it off). One link added on its own: never a replace of the whole list.
  if (business) {
    const { publishProfileId } = business
    // First offer on the business becomes its Featured one.
    const hasPrimary = await prismaClient.publishProduct.count({ where: { publishProfileId, isPrimary: true } })
    await prismaClient.publishProduct.upsert({
      where: { publishProfileId_webinarId: { publishProfileId, webinarId: webinar.id } },
      create: { publishProfileId, webinarId: webinar.id, isPrimary: hasPrimary === 0 },
      update: {},
    })
    revalidatePath('/services', 'layout')
  }
  // Every product gets its own wizard profile (Services → Wizard), separate from the others.
  await ensureOfferTourQuietly({ webinarId: webinar.id, userId: owner.user.id })
  revalidateOffer(webinar.id)
  return { ok: true, id: webinar.id }
}

export async function saveOfferDetails(input: {
  id: string
  title: string
  description: string
  /** ISO string; only used for webinars. */
  startTime?: string
}): Promise<ActionResult> {
  const owner = await requireOwner(input.id)
  if ('error' in owner) return { ok: false, error: owner.error }
  const title = input.title?.trim().slice(0, TITLE_MAX)
  if (!title) return { ok: false, error: 'Name is required' }

  const data: Prisma.WebinarUpdateInput = {
    title,
    description: input.description?.trim().slice(0, DESCRIPTION_MAX) || null,
  }
  if (owner.webinar?.kind === 'PROJECT' && input.startTime) {
    const startTime = new Date(input.startTime)
    if (Number.isNaN(startTime.getTime())) return { ok: false, error: 'Pick a valid date and time' }
    data.startTime = startTime
  }
  await prismaClient.webinar.update({ where: { id: input.id }, data })
  revalidateOffer(input.id)
  return { ok: true }
}

export async function saveOfferPricing(input: { id: string; pricing: OfferPricingInput }): Promise<ActionResult> {
  const owner = await requireOwner(input.id)
  if ('error' in owner) return { ok: false, error: owner.error }
  const pricing: OfferPricingInput = {
    currency: 'usd',
    billing: input.pricing?.billing === 'MONTHLY' ? 'MONTHLY' : 'ONE_TIME',
    amountCents: Math.round(Number(input.pricing?.amountCents)),
    deposit: {
      enabled: !!input.pricing?.deposit?.enabled,
      depositCents: Math.round(Number(input.pricing?.deposit?.depositCents)),
      balanceDueDays: Math.round(Number(input.pricing?.deposit?.balanceDueDays)),
    },
    monthlyOption: {
      enabled: !!input.pricing?.monthlyOption?.enabled,
      amountCents: Math.round(Number(input.pricing?.monthlyOption?.amountCents)),
    },
  }
  const invalid = validatePricing(pricing)
  if (invalid) return { ok: false, error: invalid }

  await writePricing(input.id, pricing)
  revalidateOffer(input.id)
  return { ok: true }
}

export async function saveOfferOrderModes(input: {
  id: string
  modes: OrderModesInput
  aiServices: AiService[]
  livekitAgentId: string | null
  /** ISO string: when the live session starts (only read when Live with you is on). */
  liveStartTime?: string
}): Promise<ActionResult> {
  const owner = await requireOwner(input.id)
  if ('error' in owner || !owner.webinar) return { ok: false, error: 'error' in owner ? owner.error : 'Offer not found' }

  const modes = Object.fromEntries(ORDER_MODE_KINDS.map((kind) => [kind, !!input.modes?.[kind]])) as OrderModesInput
  if (!ORDER_MODE_KINDS.some((kind) => modes[kind])) return { ok: false, error: 'Turn on at least one way to order' }

  const aiServices = AI_SERVICES.filter((service) => input.aiServices?.includes(service))
  let livekitAgentId: string | null = null
  if (modes.AI_ASSISTANT) {
    if (aiServices.length === 0) return { ok: false, error: 'Pick at least one AI service' }
    // One agent answers on every panel (chat and voice); the tour is the offer's own.
    if (!input.livekitAgentId) return { ok: false, error: 'Pick the AI agent that sells this offer' }
    const agent = await prismaClient.liveKitAgent.findFirst({
      where: { id: input.livekitAgentId, ...agentVisibleTo(owner.user.id) },
      select: { id: true },
    })
    if (!agent) return { ok: false, error: 'Pick one of your AI agents' }
    livekitAgentId = agent.id
  }
  const aiConfig = { services: aiServices }

  // The Live link counts down to startTime. Moving it into the future reopens the waiting room.
  let liveSchedule: Prisma.WebinarUpdateInput = {}
  if (modes.LIVE_HOST && input.liveStartTime) {
    const startTime = new Date(input.liveStartTime)
    if (Number.isNaN(startTime.getTime())) return { ok: false, error: 'Pick a valid date and time for the live session' }
    if (startTime.getTime() !== owner.webinar.startTime.getTime()) {
      liveSchedule = {
        startTime,
        ...(startTime.getTime() > Date.now() && owner.webinar.webinarStatus !== WebinarStatusEnum.LIVE
          ? { webinarStatus: WebinarStatusEnum.SCHEDULED }
          : {}),
      }
    }
  }

  await prismaClient.$transaction([
    ...ORDER_MODE_KINDS.map((kind) =>
      prismaClient.offerOrderMode.upsert({
        where: { webinarId_kind: { webinarId: input.id, kind } },
        create: {
          webinarId: input.id,
          kind,
          enabled: modes[kind],
          config: kind === OrderModeKind.AI_ASSISTANT ? aiConfig : {},
        },
        update: {
          enabled: modes[kind],
          // Keep the saved picks while AI is off, so turning it back on is one click.
          ...(kind === OrderModeKind.AI_ASSISTANT && modes.AI_ASSISTANT ? { config: aiConfig } : {}),
        },
      }),
    ),
    prismaClient.webinar.update({
      where: { id: input.id },
      data: {
        ...legacyLinkFields(owner.webinar.kind, modes),
        ...liveSchedule,
        // Keep the current agent when AI is switched off, so turning it back on is one click.
        ...(livekitAgentId ? { livekitAgentId } : {}),
      },
    }),
  ])
  revalidateOffer(input.id)
  return { ok: true }
}

/** Shows (or hides) the offer on the business page, the website SDK and in the business AI's answers. */
export async function setOfferOnBusiness(input: { id: string; enabled: boolean }): Promise<ActionResult> {
  const owner = await requireOwner(input.id)
  if ('error' in owner) return { ok: false, error: owner.error }
  const business = await getCreatorBusiness(owner.user.id)
  if (!business) return { ok: false, error: 'Create your business first' }

  const key = { publishProfileId: business.publishProfileId, webinarId: input.id }
  if (input.enabled) {
    await prismaClient.publishProduct.upsert({
      where: { publishProfileId_webinarId: key },
      create: { ...key, isPrimary: false },
      update: {},
    })
  } else {
    await prismaClient.publishProduct.deleteMany({ where: key })
  }
  revalidateOffer(input.id)
  revalidatePath('/services', 'layout')
  return { ok: true }
}

/**
 * Deletes an offer for the creator: hidden everywhere (Projects, public links, business, AI) but the
 * row stays, so its orders, payments and pipeline history keep their reference.
 */
export async function deleteOffer(input: { id: string }): Promise<ActionResult> {
  const owner = await requireOwner(input.id)
  if ('error' in owner || !owner.webinar) return { ok: false, error: 'error' in owner ? owner.error : 'Offer not found' }
  if (owner.webinar.webinarStatus === WebinarStatusEnum.LIVE) {
    return { ok: false, error: 'End the live session before deleting this webinar' }
  }

  await prismaClient.$transaction([
    prismaClient.webinar.update({ where: { id: input.id }, data: { deletedAt: new Date() } }),
    prismaClient.publishProduct.deleteMany({ where: { webinarId: input.id } }),
  ])
  revalidateOffer(input.id)
  revalidatePath('/services', 'layout')
  return { ok: true }
}
