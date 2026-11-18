import { prismaClient } from '@/lib/prismaClient'
import { loadBusinessOffers } from '@/lib/business/businessOffers'
import { siteContentFromLegacy } from '@/lib/business/siteContent'
import { loadPublicBusiness } from '@/lib/public/publicService'
import { loadServicesContext } from '../_lib/servicesContext'
import { ServicesShell } from '../_components/ServicesShell'
import { BusinessConfigurator } from './_components/BusinessConfigurator'

export default async function BusinessPage() {
  const { business, user } = await loadServicesContext()
  const [workspace, projects, linked, offers, publicBusiness] = await Promise.all([
    prismaClient.workspace.findUnique({
      where: { id: business.workspaceId },
      select: {
        contextStatus: true,
        contextVertical: true,
        contextCoreJson: true,
        contextIndustryJson: true,
        contextSocialJson: true,
        publishedAt: true,
      },
    }),
    prismaClient.webinar.findMany({
      where: { presenterId: user.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, kind: true },
    }),
    prismaClient.publishProduct.findMany({
      where: { publishProfileId: business.publishProfileId },
      select: { webinarId: true },
    }),
    loadBusinessOffers(business.publishProfileId),
    // The live view's hero buttons link to the services that are on, like the hosted site.
    loadPublicBusiness(business.roomName),
  ])

  const content = siteContentFromLegacy({
    businessName: business.name,
    vertical: workspace?.contextVertical ?? null,
    core: workspace?.contextCoreJson,
    industry: workspace?.contextIndustryJson,
    social: workspace?.contextSocialJson,
  })

  return (
    <ServicesShell title="Business">
      <BusinessConfigurator
        businessName={business.name}
        description={business.description}
        publicHref={`/business/${encodeURIComponent(business.roomName)}`}
        links={publicBusiness?.links ?? {}}
        offers={offers}
        initialContent={content}
        initialStatus={workspace?.contextStatus ?? 'DRAFT'}
        publishedAt={workspace?.publishedAt?.toISOString() ?? null}
        projects={projects}
        linkedProjectIds={linked.map((row) => row.webinarId)}
      />
    </ServicesShell>
  )
}
