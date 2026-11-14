import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { siteContentFromLegacy } from '@/lib/business/siteContent'
import { prismaClient } from '@/lib/prismaClient'
import { loadPublicBusiness, serviceAccess } from '@/lib/public/publicService'
import { PublicServiceShell, ServiceUnavailable } from '../../_components/PublicServiceShell'
import { BusinessSite, type BusinessOffer } from './_components/BusinessSite'

type Props = { params: Promise<{ roomName: string }> }

/** Business + its site content (same source as Messages → Business), loaded once per request. */
const loadSite = cache(async (roomName: string) => {
  const loaded = await loadPublicBusiness(roomName)
  if (!loaded) return null
  const [workspace, products] = await Promise.all([
    prismaClient.workspace.findUnique({
      where: { id: loaded.business.workspaceId },
      select: { contextVertical: true, contextCoreJson: true, contextIndustryJson: true, contextSocialJson: true },
    }),
    prismaClient.publishProduct.findMany({
      where: { publishProfileId: loaded.business.publishProfileId, webinar: { deletedAt: null, slug: { not: null } } },
      orderBy: [{ isPrimary: 'desc' }],
      select: { webinar: { select: { title: true, description: true, slug: true, kind: true } } },
    }),
  ])
  const content = siteContentFromLegacy({
    businessName: loaded.business.name,
    vertical: workspace?.contextVertical ?? null,
    core: workspace?.contextCoreJson,
    industry: workspace?.contextIndustryJson,
    social: workspace?.contextSocialJson,
  })
  const offers: BusinessOffer[] = products.map(({ webinar }) => ({
    title: webinar.title,
    description: webinar.description,
    // Projects (live sessions) open the Live link; products open the Share link.
    href: webinar.kind === 'PROJECT' ? `/live/${webinar.slug}` : `/o/${webinar.slug}`,
    live: webinar.kind === 'PROJECT',
  }))
  return { loaded, content, offers }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { roomName } = await params
  const site = await loadSite(decodeURIComponent(roomName))
  if (!site) return { title: 'Business', robots: { index: false } }
  const title = site.content.seo.title || site.loaded.business.name
  const description = site.content.seo.description || site.loaded.business.description || undefined
  const images = site.content.seo.ogImage ? [site.content.seo.ogImage] : undefined
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', images },
    robots: site.loaded.sitePublished ? undefined : { index: false },
  }
}

/** Business service: the creator's published business website. */
export default async function BusinessServicePage({ params }: Props) {
  const { roomName } = await params
  const site = await loadSite(decodeURIComponent(roomName))
  if (!site) notFound()

  const { loaded, content, offers } = site
  const access = serviceAccess(loaded, 'business')
  return (
    <PublicServiceShell
      businessName={loaded.business.name}
      service="business"
      links={loaded.links}
      ownerPreview={access === 'owner-preview'}
      wide
    >
      {access === 'off' ? (
        <div className="mx-auto w-full max-w-xl">
          <ServiceUnavailable title="This site isn't published yet" detail={`Please check back later or contact ${loaded.business.name}.`} />
        </div>
      ) : (
        <BusinessSite
          businessName={loaded.business.name}
          description={loaded.business.description}
          content={content}
          offers={offers}
          links={loaded.links}
        />
      )}
    </PublicServiceShell>
  )
}
