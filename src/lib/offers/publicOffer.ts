import 'server-only'
import { offerAgentRoomName } from '@/lib/offers/offerAgent'
import { cache } from 'react'
import { OfferPriceKind, OrderModeKind } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { resolveUserProviderKey } from '@/lib/credentials/providerKeys'
import { ORDER_MODE_KINDS, readAiAssistantConfig, type OrderModesInput } from './offerTypes'
import type { BuyerPriceOption, PublicOfferView } from './publicOfferTypes'
import { toOfferKind } from './offerSettings'

const SLUG_RE = /^[a-z0-9-]{1,80}$/

/** Order: default first, then deposit, then the monthly alternative. Max three. */
function buyerPrices(
  prices: Array<{
    id: string
    kind: OfferPriceKind
    amountCents: number | null
    depositCents: number | null
    balanceDueDays: number | null
    isDefault: boolean
    sortOrder: number
  }>,
): BuyerPriceOption[] {
  return [...prices]
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.sortOrder - b.sortOrder)
    .slice(0, 3)
    .map((price) => ({
      id: price.id,
      kind: price.kind,
      amountCents: price.amountCents,
      depositCents: price.depositCents,
      balanceDueDays: price.balanceDueDays,
      isDefault: price.isDefault,
    }))
}

/** Internal record used by the buyer actions (includes ids buyers never see). */
export type PublicOfferRecord = PublicOfferView & {
  creatorUserId: string
  stripeAccount: string | null
  legacyPriceId: string | null
  /** LiveKit room of the agent that sells this offer (chat + voice). */
  agentRoomName: string | null
}

export const loadPublicOffer = cache(async (slug: string): Promise<PublicOfferRecord | null> => {
  if (!SLUG_RE.test(slug)) return null
  const offer = await prismaClient.webinar.findFirst({
    where: { slug, deletedAt: null },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      kind: true,
      thumbnail: true,
      startTime: true,
      webinarStatus: true,
      priceId: true,
      presenterId: true,
      livekitAgentId: true,
      presenter: {
        select: {
          subscription: true,
          stripeConnectId: true,
          name: true,
          publishProfile: { select: { name: true, logo: true } },
        },
      },
      prices: {
        where: { active: true },
        select: {
          id: true,
          kind: true,
          amountCents: true,
          depositCents: true,
          balanceDueDays: true,
          isDefault: true,
          sortOrder: true,
        },
      },
      orderModes: { select: { kind: true, enabled: true, config: true } },
      // The product's own tour. A draft is still returned so its owner can preview it on the
      // share page; getPublicWizard only hands a draft to its owner, so buyers never see one.
      tour: { select: { slug: true } },
    },
  })
  if (!offer?.slug) return null

  const modes = Object.fromEntries(
    ORDER_MODE_KINDS.map((kind) => [kind, offer.orderModes.find((mode) => mode.kind === kind)?.enabled ?? false]),
  ) as OrderModesInput
  const aiConfig = readAiAssistantConfig(
    offer.orderModes.find((mode) => mode.kind === OrderModeKind.AI_ASSISTANT)?.config,
  )
  const agentRoomName = await offerAgentRoomName({ livekitAgentId: offer.livekitAgentId, presenterId: offer.presenterId })
  // Live with a plan, or on the creator's own Gemini key (the free way).
  const live = offer.presenter.subscription || Boolean(await resolveUserProviderKey(offer.presenterId, 'google'))
  const prices = buyerPrices(offer.prices)
  const hasPrice = prices.length > 0 || !!offer.priceId

  return {
    id: offer.id,
    slug: offer.slug,
    title: offer.title,
    description: offer.description ?? '',
    kind: toOfferKind(offer.kind),
    thumbnail: offer.thumbnail,
    startTime: offer.startTime.toISOString(),
    webinarStatus: offer.webinarStatus,
    business: {
      name: offer.presenter.publishProfile?.name || offer.presenter.name,
      logo: offer.presenter.publishProfile?.logo ?? null,
    },
    live,
    acceptingPayments: live && !!offer.presenter.stripeConnectId && hasPrice,
    prices,
    modes,
    aiServices: aiConfig.services,
    wizardSlug: offer.tour?.slug ?? null,
    creatorUserId: offer.presenterId,
    agentRoomName,
    stripeAccount: offer.presenter.stripeConnectId,
    legacyPriceId: offer.priceId,
  }
})

/** Strips server-only fields before handing the offer to a client component. */
export function toPublicView(record: PublicOfferRecord): PublicOfferView {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { creatorUserId, stripeAccount, legacyPriceId, agentRoomName, ...view } = record
  return view
}
