import 'server-only'
import { unstable_cache } from 'next/cache'
import { WebinarKind } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { isWebinarOver, summarizeOfferPrice, type OfferPriceSummary, type WebinarStatus } from './offerSummary'
import type { OrderModeKey } from './offerTypes'

/** One card on /projects. Dates are ISO strings so the row survives the data cache. */
export type CreatorOfferItem = {
  id: string
  kind: 'PRODUCT' | 'WEBINAR'
  title: string
  description: string | null
  thumbnail: string | null
  slug: string | null
  /** ISO string. Webinars only: when the live session starts. */
  startTime: string | null
  /** Webinars only. */
  status: WebinarStatus | null
  price: OfferPriceSummary | null
  onBusiness: boolean
  orderModes: { kind: OrderModeKey; enabled: boolean }[]
}

export const OFFER_FILTERS = ['all', 'products', 'webinars', 'ended'] as const
export type OfferFilter = (typeof OFFER_FILTERS)[number]

export function parseOfferFilter(value: string | undefined): OfferFilter {
  return OFFER_FILTERS.includes(value as OfferFilter) ? (value as OfferFilter) : 'all'
}

/** The creator's live (not deleted) products and webinars, newest first. Tagged 'projects-list'. */
const listCreatorOffersCached = unstable_cache(
  async (userId: string): Promise<CreatorOfferItem[]> => {
    const [rows, workspace] = await Promise.all([
      prismaClient.webinar.findMany({
        where: { presenterId: userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          kind: true,
          title: true,
          description: true,
          thumbnail: true,
          slug: true,
          startTime: true,
          webinarStatus: true,
          orderModes: { select: { kind: true, enabled: true } },
          prices: {
            where: { active: true },
            select: { kind: true, amountCents: true, currency: true, isDefault: true, active: true },
          },
          publishProducts: { select: { publishProfileId: true } },
        },
      }),
      prismaClient.workspace.findUnique({ where: { userId }, select: { publishProfileId: true } }),
    ])
    const publishProfileId = workspace?.publishProfileId ?? null

    return rows.map((row) => {
      const isWebinar = row.kind === WebinarKind.PROJECT
      return {
        id: row.id,
        kind: isWebinar ? 'WEBINAR' : 'PRODUCT',
        title: row.title,
        description: row.description,
        thumbnail: row.thumbnail,
        slug: row.slug,
        startTime: isWebinar ? row.startTime.toISOString() : null,
        status: isWebinar ? row.webinarStatus : null,
        price: summarizeOfferPrice(row.prices),
        onBusiness: !!publishProfileId && row.publishProducts.some((link) => link.publishProfileId === publishProfileId),
        orderModes: row.orderModes,
      }
    })
  },
  ['creator-offers-v1'],
  { revalidate: 20, tags: ['projects-list'] },
)

export async function listCreatorOffers(userId: string, filter: OfferFilter): Promise<CreatorOfferItem[]> {
  let offers: CreatorOfferItem[] = []
  try {
    offers = await listCreatorOffersCached(userId)
  } catch (error) {
    console.error('[creatorOffers] list failed', error instanceof Error ? error.message : error)
    return []
  }
  const over = (offer: CreatorOfferItem) => offer.status !== null && isWebinarOver(offer.status)
  switch (filter) {
    case 'products':
      return offers.filter((offer) => offer.kind === 'PRODUCT')
    case 'webinars':
      return offers.filter((offer) => offer.kind === 'WEBINAR' && !over(offer))
    case 'ended':
      return offers.filter(over)
    default:
      return offers
  }
}
