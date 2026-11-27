'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { OrderModeKind, WebinarStatusEnum, type Prisma, type User, type WebinarKind } from '@prisma/client'
import { onAuthenticateUser } from '@/actions/auth'
import { prismaClient } from '@/lib/prismaClient'
import { ensureOfferTourQuietly } from '@/lib/wizard/wizardRepo'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'
import { PAID_ACCESS_ERROR, userCanGoLive } from '@/lib/billing/paidAccess'
import { buildOfferSlug } from '@/lib/offers/offerModel'
import { stripe } from '@/lib/stripe'
import {
  agentVisibleTo,
  defaultOrderModes,
  getOfferSettingsForOwner,
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
  type OfferSettingsView,
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
  if (!(await userCanGoLive(auth.user.id))) return { error: PAID_ACCESS_ERROR }
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
      // No agent of its own: the Services assistants (Chat AI, Voice AI) answer for it.
      livekitAgentId: null,
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
  /** An https image link (no uploads); empty clears it, undefined leaves it as is. */
  thumbnail?: string
}): Promise<ActionResult> {
  const owner = await requireOwner(input.id)
  if ('error' in owner) return { ok: false, error: owner.error }
  const title = input.title?.trim().slice(0, TITLE_MAX)
  if (!title) return { ok: false, error: 'Name is required' }

  const data: Prisma.WebinarUpdateInput = {
    title,
    description: input.description?.trim().slice(0, DESCRIPTION_MAX) || null,
  }
  if (input.thumbnail !== undefined) {
    const link = input.thumbnail.trim()
    if (link && !/^https:\/\/[^\s]{4,500}$/i.test(link)) return { ok: false, error: 'The image link must start with https://' }
    data.thumbnail = link || null
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
    if (aiServices.length === 0) return { ok: false, error: 'Pick at least one way to talk (chat, tour or voice)' }
    // No agent = the Services assistants answer (Chat AI on chat, Voice AI on voice). An agent here
    // is this product's own override; the tour is always the product's own.
    if (input.livekitAgentId) {
      const agent = await prismaClient.liveKitAgent.findFirst({
        where: { id: input.livekitAgentId, ...agentVisibleTo(owner.user.id) },
        select: { id: true },
      })
      if (!agent) return { ok: false, error: 'Pick one of your AI agents' }
      livekitAgentId = agent.id
    }
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
        // With AI on, save the pick (null = use the Services assistants). With AI off, keep it, so
        // turning AI back on is one click.
        ...(modes.AI_ASSISTANT ? { livekitAgentId } : {}),
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

// ── Prices from the creator's Stripe catalog ────────────────────────────────

export type StripeCatalogProduct = {
  productId: string
  name: string
  image: string | null
  prices: { priceId: string; amountCents: number; billing: 'ONE_TIME' | 'MONTHLY'; label: string | null }[]
}

/**
 * The creator's Stripe products (their connected account) with every active USD price that is
 * one-time or monthly, newest first. Archived products are left out.
 */
export async function listStripeCatalog(): Promise<ActionResult<{ products: StripeCatalogProduct[] }>> {
  const owner = await requireOwner()
  if ('error' in owner) return { ok: false, error: owner.error }
  const stripeAccount = owner.user.stripeConnectId
  if (!stripeAccount) return { ok: false, error: 'Connect Stripe in Settings to use your products' }
  try {
    const byProduct = new Map<string, StripeCatalogProduct>()
    for await (const price of stripe.prices.list({ active: true, limit: 100, expand: ['data.product'] }, { stripeAccount })) {
      const product = price.product
      if (typeof product === 'string' || !product || ('deleted' in product && product.deleted) || !product.active) continue
      if (price.currency !== 'usd' || price.unit_amount == null) continue
      const recurring = price.recurring
      if (recurring && !(recurring.interval === 'month' && recurring.interval_count === 1)) continue
      const entry = byProduct.get(product.id) ?? {
        productId: product.id,
        name: product.name,
        image: product.images?.[0] ?? null,
        prices: [],
      }
      entry.prices.push({ priceId: price.id, amountCents: price.unit_amount, billing: recurring ? 'MONTHLY' : 'ONE_TIME', label: price.nickname })
      byProduct.set(product.id, entry)
      if (byProduct.size >= 200) break
    }
    return { ok: true, products: [...byProduct.values()] }
  } catch (error) {
    console.error('[listStripeCatalog]', error instanceof Error ? error.message : error)
    return { ok: false, error: "Couldn't load your Stripe products. Try again." }
  }
}

/** Creates a product with one price in the creator's Stripe account, so new offers live in Stripe too. */
export async function createStripeCatalogPrice(input: {
  name: string
  amountCents: number
  billing: 'ONE_TIME' | 'MONTHLY'
}): Promise<ActionResult<{ product: StripeCatalogProduct }>> {
  const owner = await requireOwner()
  if ('error' in owner) return { ok: false, error: owner.error }
  const stripeAccount = owner.user.stripeConnectId
  if (!stripeAccount) return { ok: false, error: 'Connect Stripe in Settings first' }
  const name = input.name?.trim().slice(0, 250)
  const amountCents = Math.round(Number(input.amountCents))
  if (!name) return { ok: false, error: 'Give the product a name' }
  if (!Number.isFinite(amountCents) || amountCents < 50) return { ok: false, error: 'The price must be at least $0.50' }
  const monthly = input.billing === 'MONTHLY'
  try {
    const product = await stripe.products.create(
      {
        name,
        default_price_data: { currency: 'usd', unit_amount: amountCents, ...(monthly ? { recurring: { interval: 'month' } } : {}) },
      },
      { stripeAccount },
    )
    const priceId = typeof product.default_price === 'string' ? product.default_price : product.default_price?.id
    if (!priceId) throw new Error('Stripe returned no price')
    return {
      ok: true,
      product: {
        productId: product.id,
        name: product.name,
        image: null,
        prices: [{ priceId, amountCents, billing: monthly ? 'MONTHLY' : 'ONE_TIME', label: null }],
      },
    }
  } catch (error) {
    console.error('[createStripeCatalogPrice]', error instanceof Error ? error.message : error)
    return { ok: false, error: "Couldn't create the product in Stripe. Try again." }
  }
}

/**
 * Prices an offer from the creator's Stripe catalog. The main price (and the optional monthly
 * alternative) are read from Stripe, so the amounts are Stripe's; a deposit is a part of the main
 * one-time price (Stripe has no deposit prices).
 */
export async function saveOfferStripePricing(input: {
  id: string
  priceId: string
  deposit?: { depositCents: number; balanceDueDays: number } | null
  monthlyPriceId?: string | null
}): Promise<ActionResult> {
  const owner = await requireOwner(input.id)
  if ('error' in owner) return { ok: false, error: owner.error }
  const stripeAccount = owner.user.stripeConnectId
  if (!stripeAccount) return { ok: false, error: 'Connect Stripe in Settings first' }

  const read = async (priceId: string) => {
    const price = await stripe.prices.retrieve(priceId, {}, { stripeAccount })
    if (!price.active || price.currency !== 'usd' || price.unit_amount == null) return null
    const productId = typeof price.product === 'string' ? price.product : price.product.id
    const monthly = price.recurring?.interval === 'month' && price.recurring.interval_count === 1
    if (price.recurring && !monthly) return null
    return { priceId: price.id, productId, amountCents: price.unit_amount, billing: monthly ? ('MONTHLY' as const) : ('ONE_TIME' as const) }
  }

  try {
    const main = await read(String(input.priceId || ''))
    if (!main) return { ok: false, error: 'Pick an active one-time or monthly USD price' }
    const monthlyOption = input.monthlyPriceId ? await read(input.monthlyPriceId) : null
    if (input.monthlyPriceId && (!monthlyOption || monthlyOption.billing !== 'MONTHLY')) {
      return { ok: false, error: 'The monthly option must be a monthly price' }
    }
    const pricing: OfferPricingInput = {
      currency: 'usd',
      billing: main.billing,
      amountCents: main.amountCents,
      stripe: { priceId: main.priceId, productId: main.productId },
      deposit: {
        enabled: !!input.deposit && main.billing === 'ONE_TIME',
        depositCents: Math.round(Number(input.deposit?.depositCents)),
        balanceDueDays: Math.round(Number(input.deposit?.balanceDueDays)),
      },
      monthlyOption: {
        enabled: !!monthlyOption && main.billing === 'ONE_TIME',
        amountCents: monthlyOption?.amountCents ?? 0,
        stripe: monthlyOption ? { priceId: monthlyOption.priceId, productId: monthlyOption.productId } : null,
      },
    }
    const invalid = validatePricing(pricing)
    if (invalid) return { ok: false, error: invalid }
    await writePricing(input.id, pricing)
    revalidateOffer(input.id)
    return { ok: true }
  } catch (error) {
    console.error('[saveOfferStripePricing]', error instanceof Error ? error.message : error)
    return { ok: false, error: "Couldn't read that price from Stripe. Try again." }
  }
}

/** Everything the project popup needs to edit an offer. */
export async function getOfferForEdit(input: { id: string }): Promise<ActionResult<{ offer: OfferSettingsView }>> {
  const owner = await requireOwner(input.id)
  if ('error' in owner) return { ok: false, error: owner.error }
  const offer = await getOfferSettingsForOwner(input.id, owner.user.id)
  return offer ? { ok: true, offer } : { ok: false, error: 'Offer not found' }
}
