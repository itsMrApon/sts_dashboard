import 'server-only'
import { prismaClient } from '@/lib/prismaClient'
import { enabledModes, primaryOfferLink } from '@/lib/offers/offerLinks'
import { isWebinarOver } from '@/lib/offers/offerSummary'

export type BusinessOffer = { title: string; description: string | null; href: string; live: boolean }

/**
 * Projects and products listed on the business site (hosted page and the Services live view).
 * Ended webinars and offers with no way to order on are left out; each links to its primary link.
 */
export async function loadBusinessOffers(publishProfileId: string): Promise<BusinessOffer[]> {
  const products = await prismaClient.publishProduct.findMany({
    where: { publishProfileId, webinar: { deletedAt: null, slug: { not: null } } },
    orderBy: [{ isPrimary: 'desc' }],
    select: {
      webinar: {
        select: {
          title: true,
          description: true,
          slug: true,
          kind: true,
          webinarStatus: true,
          orderModes: { select: { kind: true, enabled: true } },
        },
      },
    },
  })
  return products.flatMap(({ webinar }) => {
    if (webinar.kind === 'PROJECT' && isWebinarOver(webinar.webinarStatus)) return []
    const link = primaryOfferLink(webinar, enabledModes(webinar.orderModes), '')
    if (!link) return []
    return [{ title: webinar.title, description: webinar.description, href: link.url, live: link.variant === 'live' }]
  })
}
