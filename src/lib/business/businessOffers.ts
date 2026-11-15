import 'server-only'
import { prismaClient } from '@/lib/prismaClient'

export type BusinessOffer = { title: string; description: string | null; href: string; live: boolean }

/** Projects and products listed on the business site (hosted page and the Services live view). */
export async function loadBusinessOffers(publishProfileId: string): Promise<BusinessOffer[]> {
  const products = await prismaClient.publishProduct.findMany({
    where: { publishProfileId, webinar: { deletedAt: null, slug: { not: null } } },
    orderBy: [{ isPrimary: 'desc' }],
    select: { webinar: { select: { title: true, description: true, slug: true, kind: true } } },
  })
  return products.map(({ webinar }) => ({
    title: webinar.title,
    description: webinar.description,
    // Projects (live sessions) open the Live link; products open the Share link.
    href: webinar.kind === 'PROJECT' ? `/live/${webinar.slug}` : `/o/${webinar.slug}`,
    live: webinar.kind === 'PROJECT',
  }))
}
