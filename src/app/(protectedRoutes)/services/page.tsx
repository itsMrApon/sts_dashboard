import { prismaClient } from '@/lib/prismaClient'
import { getBusinessServices, type ServiceAssistant } from '@/lib/services/serviceConfig'
import { liveSessionsForSite, loadBusinessOffers, loadUpcomingLiveSessions } from '@/lib/business/businessOffers'
import { siteContentFromLegacy } from '@/lib/business/siteContent'
import { loadServicesContext } from './_lib/servicesContext'
import { ServicesFolders, type HubStatus } from './_components/ServicesFolders'

/** A service card's status: live, off, or still waiting for its assistant (AI Agents). */
function serviceStatus(on: boolean, agent: ServiceAssistant | null): HubStatus {
  if (!agent) return { on: false, label: 'Needs assistant' }
  return { on, label: `${on ? 'On' : 'Off'} · ${agent.name}` }
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/** A count-based card status: on once there is at least one item. */
function countStatus(count: number, word: string, empty: string): HubStatus {
  return count > 0 ? { on: true, label: plural(count, word) } : { on: false, label: empty }
}

/** Services home: the website services as a folder tray. Each one is run by its own AI Agents assistant. */
export default async function ServicesPage() {
  const { business } = await loadServicesContext()
  const [services, wizard, workspace, offers, liveSessions] = await Promise.all([
    getBusinessServices(business.workspaceId),
    prismaClient.voiceWizard.findFirst({ where: { userId: business.userId, webinarId: null }, select: { isPublished: true } }),
    prismaClient.workspace.findUnique({
      where: { id: business.workspaceId },
      select: { contextVertical: true, contextCoreJson: true, contextIndustryJson: true, contextSocialJson: true },
    }),
    loadBusinessOffers(business.publishProfileId),
    loadUpcomingLiveSessions(business.publishProfileId, ''),
  ])
  const site = siteContentFromLegacy({
    businessName: business.name,
    vertical: workspace?.contextVertical ?? null,
    core: workspace?.contextCoreJson,
    industry: workspace?.contextIndustryJson,
    social: workspace?.contextSocialJson,
  })
  const menuItems = offers.length + site.services.filter((service) => service.active).length
  const docCount = site.docs.length
  const shownLive = liveSessionsForSite(liveSessions, site.live).length
  const contactReady = Boolean(site.footer.phone || site.footer.email)
  const tourLive = Boolean(wizard?.isPublished && services.tour.agent)

  return (
    <div className="flex w-full flex-col gap-3">
      <ServicesFolders
        status={{
          chat: serviceStatus(services.chat.enabled, services.chat.agent),
          speak: serviceStatus(services.speak.enabled, services.speak.agent),
          form: serviceStatus(services.form.enabled, services.form.agent),
          wizard: services.tour.agent
            ? { on: tourLive, label: `${tourLive ? 'Live' : wizard ? 'Draft' : 'Off'} · ${services.tour.agent.name}` }
            : { on: false, label: 'Needs assistant' },
          menu: countStatus(menuItems, 'item', 'Empty'),
          docs: countStatus(docCount, 'document', 'No documents'),
          links: countStatus(site.social.accounts.length, 'account', 'No accounts'),
          live: !site.live.enabled
            ? { on: false, label: 'Off' }
            : shownLive > 0
              ? { on: true, label: `${shownLive} upcoming` }
              : liveSessions.length > 0
                ? { on: false, label: 'None on website' }
                : { on: false, label: 'None scheduled' },
          contact: contactReady ? { on: true, label: 'Ready' } : { on: false, label: 'Add phone or email' },
        }}
      />
    </div>
  )
}
