import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { siteContentFromLegacy } from '@/lib/business/siteContent'
import { prismaClient } from '@/lib/prismaClient'
import { loadPublicBusiness, serviceAccess } from '@/lib/public/publicService'
import { PublicServiceShell, ServiceUnavailable } from '../../_components/PublicServiceShell'
import { loadBusinessOffers } from '@/lib/business/businessOffers'
import { BusinessSite } from './_components/BusinessSite'

type Props = { params: Promise<{ roomName: string }> }

/** Business + its site content (same source as Services → Business), loaded once per request. */
const loadSite = cache(async (roomName: string) => {
  const loaded = await loadPublicBusiness(roomName)
  if (!loaded) return null
  const [workspace, offers] = await Promise.all([
    prismaClient.workspace.findUnique({
      where: { id: loaded.business.workspaceId },
      select: { contextVertical: true, contextCoreJson: true, contextIndustryJson: true, contextSocialJson: true },
    }),
    loadBusinessOffers(loaded.business.publishProfileId),
  ])
  const content = siteContentFromLegacy({
    businessName: loaded.business.name,
    vertical: workspace?.contextVertical ?? null,
    core: workspace?.contextCoreJson,
    industry: workspace?.contextIndustryJson,
    social: workspace?.contextSocialJson,
  })
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
