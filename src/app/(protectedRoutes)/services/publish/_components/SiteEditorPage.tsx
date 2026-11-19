import { prismaClient } from '@/lib/prismaClient'
import { headers } from 'next/headers'
import { loadBusinessOffers, loadUpcomingLiveSessions } from '@/lib/business/businessOffers'
import { siteContentFromLegacy } from '@/lib/business/siteContent'
import { loadPublicBusiness } from '@/lib/public/publicService'
import { loadServicesContext } from '../../_lib/servicesContext'
import { ServicesShell } from '../../_components/ServicesShell'
import { BusinessConfigurator, type SiteEditorId } from './BusinessConfigurator'

/**
 * One website service page (Menu, Docs, Links, Live, Contact). All of them edit the same published site
 * content, so each has the same Save & publish.
 */
async function appOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  const list = await headers()
  const host = list.get('x-forwarded-host') ?? list.get('host') ?? 'localhost:3000'
  const proto = list.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export async function SiteEditorPage({ editor, title }: { editor: SiteEditorId; title: string }) {
  const { business, user } = await loadServicesContext()
  const [workspace, projects, linked, offers, publicBusiness, liveSessions] = await Promise.all([
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
    editor === 'live' ? appOrigin().then((origin) => loadUpcomingLiveSessions(business.publishProfileId, origin)) : [],
  ])

  const content = siteContentFromLegacy({
    businessName: business.name,
    vertical: workspace?.contextVertical ?? null,
    core: workspace?.contextCoreJson,
    industry: workspace?.contextIndustryJson,
    social: workspace?.contextSocialJson,
  })

  return (
    <ServicesShell title={title}>
      <BusinessConfigurator
        editor={editor}
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
        liveSessions={liveSessions}
      />
    </ServicesShell>
  )
}
