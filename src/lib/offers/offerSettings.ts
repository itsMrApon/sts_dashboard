import 'server-only'
import {
  CtaTypeEnum,
  OfferPriceKind,
  OrderModeKind,
  WebinarKind,
  type OfferPrice,
  type Prisma,
} from '@prisma/client'
import { stripe } from '@/lib/stripe'
import { prismaClient } from '@/lib/prismaClient'
import type { WebinarLinkVariant } from '@/lib/webinarLinkVariants'
import { buildOfferShareLinks } from './offerLinks'
import { publicBaseUrl } from './publicBaseUrl'
import { pickDefaultPrice } from './offerSummary'
import {
  AI_SERVICES,
  ORDER_MODE_KINDS,
  PRICE_LIMITS,
  readAiAssistantConfig,
  type OfferKindInput,
  type OfferPricingInput,
  type OfferSettingsView,
  type OrderModesInput,
} from './offerTypes'

// ---------------------------------------------------------------------------
// Kind + legacy link fields
// ---------------------------------------------------------------------------

export function toWebinarKind(kind: OfferKindInput): WebinarKind {
  return kind === 'PRODUCT' ? WebinarKind.PRODUCT : WebinarKind.PROJECT
}

export function toOfferKind(kind: WebinarKind): OfferKindInput {
  return kind === WebinarKind.PRODUCT ? 'PRODUCT' : 'WEBINAR'
}

/**
 * The public pages still read `linkVariants` / `ctaType` until they move to /o/[slug] (step 3).
 * Reverse of the backfill mapping. DIRECT_PAY has no legacy page.
 */
export function legacyLinkFields(
  kind: WebinarKind,
  modes: OrderModesInput,
): { linkVariants: WebinarLinkVariant[]; ctaType: CtaTypeEnum } {
  const variants: WebinarLinkVariant[] = []
  if (modes.AI_ASSISTANT) variants.push(kind === WebinarKind.PRODUCT ? 'PRODUCT_BOOK_A_CALL' : 'PROJECT_BOOK_A_CALL')
  if (modes.INSTANT_CHECKOUT) variants.push('PRODUCT_BUY_NOW')
  if (modes.LIVE_HOST) variants.push('PROJECT_BUY_NOW')
  // The live session always sells with Buy now; Book a call only remains for AI-only offers.
  return {
    linkVariants: variants,
    ctaType: modes.AI_ASSISTANT && !modes.LIVE_HOST ? CtaTypeEnum.BOOK_A_CALL : CtaTypeEnum.BUY_NOW,
  }
}

export function defaultOrderModes(kind: OfferKindInput, hasAgent: boolean): OrderModesInput {
  return {
    INSTANT_CHECKOUT: true,
    AI_ASSISTANT: kind === 'PRODUCT' && hasAgent,
    LIVE_HOST: kind === 'WEBINAR',
    DIRECT_PAY: false,
  }
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

/** Same visibility as getLiveKitAgents: the creator's agents plus legacy unowned ones. */
export function agentVisibleTo(userId: string): Prisma.LiveKitAgentWhereInput {
  return { OR: [{ userId }, { userId: null }] }
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

function isValidAmount(cents: number): boolean {
  return Number.isInteger(cents) && cents >= PRICE_LIMITS.minCents && cents <= PRICE_LIMITS.maxCents
}

export function validatePricing(input: OfferPricingInput): string | null {
  if (!isValidAmount(input.amountCents)) return 'Price must be between $0.50 and $999,999'
  if (input.billing === 'MONTHLY' && (input.deposit.enabled || input.monthlyOption.enabled)) {
    return 'Deposit and a monthly option only apply to one-time prices'
  }
  if (input.deposit.enabled) {
    if (!isValidAmount(input.deposit.depositCents) || input.deposit.depositCents >= input.amountCents) {
      return 'Deposit must be at least $0.50 and less than the full price'
    }
    const days = input.deposit.balanceDueDays
    if (!Number.isInteger(days) || days < 1 || days > PRICE_LIMITS.maxBalanceDays) {
      return `Balance due must be 1 to ${PRICE_LIMITS.maxBalanceDays} days`
    }
  }
  if (input.monthlyOption.enabled && !isValidAmount(input.monthlyOption.amountCents)) {
    return 'Monthly option must be between $0.50 and $999,999'
  }
  return null
}

type PriceRow = Pick<
  OfferPrice,
  'id' | 'kind' | 'amountCents' | 'currency' | 'depositCents' | 'balanceDueDays' | 'stripePriceId' | 'isDefault' | 'active'
>

/** The buyer-facing default (what "Buy now" charges today). Shared with the client-safe summary. */
export { pickDefaultPrice }

function pricingFromRows(prices: PriceRow[]): OfferPricingInput & { legacyPriceUnsynced: boolean } {
  const main = pickDefaultPrice(prices)
  const deposit = prices.find((price) => price.active && price.kind === OfferPriceKind.DEPOSIT)
  const monthlyOption = prices.find(
    (price) => price.active && price.kind === OfferPriceKind.MONTHLY && price.id !== main?.id,
  )
  const amountCents = main?.amountCents ?? 0
  return {
    currency: 'usd',
    billing: main?.kind === OfferPriceKind.MONTHLY ? 'MONTHLY' : 'ONE_TIME',
    amountCents,
    deposit: {
      enabled: !!deposit,
      depositCents: deposit?.depositCents ?? Math.round(amountCents / 4),
      balanceDueDays: deposit?.balanceDueDays ?? 14,
    },
    monthlyOption: { enabled: !!monthlyOption, amountCents: monthlyOption?.amountCents ?? 0 },
    legacyPriceUnsynced: !!main && main.amountCents == null,
  }
}

/**
 * Prices migrated from the old single Stripe price have no amount yet. Read it once from the
 * creator's connected account and store it, so the settings page and checkout use our own amount.
 */
async function syncLegacyPriceAmount(price: PriceRow, stripeAccount: string | null): Promise<void> {
  if (price.amountCents != null || !price.stripePriceId || !stripeAccount) return
  try {
    const stripePrice = await stripe.prices.retrieve(price.stripePriceId, {}, { stripeAccount })
    if (stripePrice.unit_amount == null) return
    const monthly = stripePrice.recurring?.interval === 'month'
    await prismaClient.offerPrice.update({
      where: { id: price.id },
      data: {
        amountCents: stripePrice.unit_amount,
        currency: stripePrice.currency,
        kind: monthly ? OfferPriceKind.MONTHLY : OfferPriceKind.ONE_TIME,
      },
    })
  } catch (error) {
    console.warn('[offerSettings] legacy price sync failed', error instanceof Error ? error.message : error)
  }
}

/**
 * One row per kind; rows that are switched off are deactivated (not deleted) so past orders
 * keep their price reference.
 */
export async function writePricing(webinarId: string, input: OfferPricingInput): Promise<void> {
  const existing = await prismaClient.offerPrice.findMany({ where: { webinarId }, orderBy: { createdAt: 'asc' } })
  const byKind = (kind: OfferPriceKind) => existing.find((price) => price.kind === kind)

  const mainKind = input.billing === 'MONTHLY' ? OfferPriceKind.MONTHLY : OfferPriceKind.ONE_TIME
  const wanted: Array<{ kind: OfferPriceKind; data: Prisma.OfferPriceUncheckedCreateInput }> = [
    {
      kind: mainKind,
      data: { webinarId, kind: mainKind, amountCents: input.amountCents, currency: input.currency, isDefault: true, sortOrder: 0 },
    },
  ]
  if (input.deposit.enabled) {
    wanted.push({
      kind: OfferPriceKind.DEPOSIT,
      data: {
        webinarId,
        kind: OfferPriceKind.DEPOSIT,
        amountCents: input.amountCents,
        depositCents: input.deposit.depositCents,
        balanceDueDays: input.deposit.balanceDueDays,
        currency: input.currency,
        sortOrder: 1,
      },
    })
  }
  if (input.monthlyOption.enabled) {
    wanted.push({
      kind: OfferPriceKind.MONTHLY,
      data: { webinarId, kind: OfferPriceKind.MONTHLY, amountCents: input.monthlyOption.amountCents, currency: input.currency, sortOrder: 2 },
    })
  }

  const wantedKinds = new Set(wanted.map((item) => item.kind))
  const ops: Prisma.PrismaPromise<unknown>[] = []
  for (const item of wanted) {
    const current = byKind(item.kind)
    // A creator-set amount replaces any legacy Stripe price on that row.
    const data = { ...item.data, active: true, isDefault: item.data.isDefault ?? false, stripePriceId: null }
    ops.push(
      current
        ? prismaClient.offerPrice.update({ where: { id: current.id }, data })
        : prismaClient.offerPrice.create({ data }),
    )
  }
  for (const price of existing) {
    if (!wantedKinds.has(price.kind) && (price.active || price.isDefault)) {
      ops.push(prismaClient.offerPrice.update({ where: { id: price.id }, data: { active: false, isDefault: false } }))
    }
  }
  await prismaClient.$transaction(ops)
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

export async function getOfferSettingsForOwner(webinarId: string, userId: string): Promise<OfferSettingsView | null> {
  const load = () =>
    prismaClient.webinar.findFirst({
      where: { id: webinarId, presenterId: userId, deletedAt: null },
      include: {
        prices: { orderBy: { sortOrder: 'asc' } },
        orderModes: true,
        presenter: { select: { stripeConnectId: true, subscription: true } },
        publishProducts: { select: { publishProfileId: true } },
      },
    })

  let webinar = await load()
  if (!webinar) return null

  const legacy = webinar.prices.find((price) => price.amountCents == null && price.stripePriceId)
  if (legacy) {
    await syncLegacyPriceAmount(legacy, webinar.presenter.stripeConnectId)
    webinar = (await load()) ?? webinar
  }

  const [agents, business, orders, tour] = await Promise.all([
    prismaClient.liveKitAgent.findMany({
      where: agentVisibleTo(userId),
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    }),
    prismaClient.workspace.findUnique({ where: { userId }, select: { publishProfileId: true } }),
    // Abandoned checkouts (PENDING) are listed too: they are warm leads.
    prismaClient.order.findMany({
      where: { webinarId, userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        orderMode: true,
        source: true,
        currency: true,
        amountTotalCents: true,
        amountPaidCents: true,
        createdAt: true,
        offerPrice: { select: { kind: true } },
        contact: { select: { name: true, email: true, phone: true } },
      },
    }),
    prismaClient.voiceWizard.findUnique({ where: { webinarId }, select: { isPublished: true, steps: true } }),
  ])
  const counted = orders.filter((order) => order.status === 'PAID' || order.status === 'DEPOSIT_PAID')

  const modes = Object.fromEntries(
    ORDER_MODE_KINDS.map((kind) => [kind, webinar.orderModes.find((mode) => mode.kind === kind)?.enabled ?? false]),
  ) as OrderModesInput
  const aiMode = webinar.orderModes.find((mode) => mode.kind === OrderModeKind.AI_ASSISTANT)
  const aiConfig = readAiAssistantConfig(aiMode?.config)
  const baseUrl = publicBaseUrl()

  return {
    id: webinar.id,
    title: webinar.title,
    description: webinar.description ?? '',
    kind: toOfferKind(webinar.kind),
    startTime: webinar.startTime.toISOString(),
    slug: webinar.slug,
    pricing: pricingFromRows(webinar.prices),
    modes,
    aiServices: aiConfig.services.length ? aiConfig.services : [...AI_SERVICES],
    livekitAgentId: webinar.livekitAgentId,
    tour: {
      status: tour ? (tour.isPublished ? 'published' : 'draft') : 'none',
      steps: Array.isArray(tour?.steps) ? tour.steps.length : 0,
    },
    agents,
    hasBusiness: !!business?.publishProfileId,
    onBusiness:
      !!business?.publishProfileId &&
      webinar.publishProducts.some((link) => link.publishProfileId === business.publishProfileId),
    stripeConnected: !!webinar.presenter.stripeConnectId,
    hasPaidAccess: webinar.presenter.subscription,
    shareLinks: buildOfferShareLinks(webinar.slug, modes, baseUrl),
    orders: orders.map((order) => ({
      id: order.id,
      status: order.status,
      way: order.orderMode,
      priceKind: order.offerPrice?.kind ?? null,
      source: order.source,
      currency: order.currency,
      amountTotalCents: order.amountTotalCents,
      amountPaidCents: order.amountPaidCents,
      createdAt: order.createdAt.toISOString(),
      buyer: order.contact ? (order.contact.name ?? order.contact.email ?? order.contact.phone) : null,
    })),
    orderSummary: {
      collectedCents: counted.reduce((sum, order) => sum + order.amountPaidCents, 0),
      paidCount: counted.length,
      balanceDueCents: counted
        .filter((order) => order.status === 'DEPOSIT_PAID')
        .reduce((sum, order) => sum + Math.max(0, order.amountTotalCents - order.amountPaidCents), 0),
    },
  }
}
