import { ContextStatusEnum } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { getBusinessServices, type ServiceAssistant } from '@/lib/services/serviceConfig'
import { loadServicesContext } from './_lib/servicesContext'
import { ServicesHubCards, type HubStatus } from './_components/ServicesHubCards'

/** A service card's status: live, off, or still waiting for its assistant (AI Agents). */
function serviceStatus(on: boolean, agent: ServiceAssistant | null): HubStatus {
  if (!agent) return { on: false, label: 'Needs assistant' }
  return { on, label: `${on ? 'On' : 'Off'} · ${agent.name}` }
}

/** Services home: the website services. Each one is run by its own AI Agents assistant. */
export default async function ServicesPage() {
  const { business } = await loadServicesContext()
  const [services, wizard, workspace] = await Promise.all([
    getBusinessServices(business.workspaceId),
    prismaClient.voiceWizard.findFirst({ where: { userId: business.userId, webinarId: null }, select: { isPublished: true } }),
    prismaClient.workspace.findUnique({ where: { id: business.workspaceId }, select: { contextStatus: true } }),
  ])
  const published = workspace?.contextStatus === ContextStatusEnum.PUBLISHED
  const tourLive = Boolean(wizard?.isPublished && services.tour.agent)

  return (
    <div className="flex w-full flex-col gap-3">
      <ServicesHubCards
        status={{
          chat: serviceStatus(services.chat.enabled, services.chat.agent),
          speak: serviceStatus(services.speak.enabled, services.speak.agent),
          form: serviceStatus(services.form.enabled, services.form.agent),
          wizard: services.tour.agent
            ? { on: tourLive, label: `${tourLive ? 'Live' : wizard ? 'Draft' : 'Off'} · ${services.tour.agent.name}` }
            : { on: false, label: 'Needs assistant' },
          business: { on: published, label: published ? 'Published' : 'Draft' },
        }}
      />
    </div>
  )
}
