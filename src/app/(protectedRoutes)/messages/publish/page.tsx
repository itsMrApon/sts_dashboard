import { prismaClient } from '@/lib/prismaClient'
import { siteContentFromLegacy } from '@/lib/business/siteContent'
import { loadMessagesContext } from '../_lib/messagesContext'
import { MessagesShell } from '../_components/MessagesShell'
import { BusinessConfigurator } from './_components/BusinessConfigurator'

export default async function BusinessPage() {
  const { business, user } = await loadMessagesContext()
  const [workspace, projects, linked] = await Promise.all([
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
      where: { presenterId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, kind: true },
    }),
    prismaClient.publishProduct.findMany({
      where: { publishProfileId: business.publishProfileId },
      select: { webinarId: true },
    }),
  ])

  const content = siteContentFromLegacy({
    businessName: business.name,
    vertical: workspace?.contextVertical ?? null,
    core: workspace?.contextCoreJson,
    industry: workspace?.contextIndustryJson,
    social: workspace?.contextSocialJson,
  })

  return (
    <MessagesShell
      businessName={business.name}
      title="Business"
      description="Everything your website shows about you — SEO, footer, socials, services & forms and key dates. Your AI reads it too."
    >
      <BusinessConfigurator
        businessName={business.name}
        roomName={business.roomName}
        publicHref={`/business/${encodeURIComponent(business.roomName)}`}
        initialContent={content}
        initialStatus={workspace?.contextStatus ?? 'DRAFT'}
        publishedAt={workspace?.publishedAt?.toISOString() ?? null}
        projects={projects}
        linkedProjectIds={linked.map((row) => row.webinarId)}
      />
    </MessagesShell>
  )
}
