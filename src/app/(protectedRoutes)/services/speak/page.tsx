import { listAssistants } from '@/actions/assistants'
import { buildAgentContext } from '@/lib/messages/buildAgentContext'
import { getBusinessServices } from '@/lib/services/serviceConfig'
import { loadServicesContext } from '../_lib/servicesContext'
import { ServicesShell } from '../_components/ServicesShell'
import { SpeakConfigurator } from './_components/SpeakConfigurator'

export default async function SpeakAiPage() {
  const { business } = await loadServicesContext()
  const [services, assistants, context] = await Promise.all([
    getBusinessServices(business.workspaceId),
    listAssistants(),
    // "Talk to a person" in the live call (light homePreview build, same as the hosted page).
    buildAgentContext(business.roomName, { mode: 'homePreview' }),
  ])
  const agent = services.speak.agent

  return (
    <ServicesShell title="Voice AI">
      <SpeakConfigurator
        mode="service"
        roomName={business.roomName}
        businessName={business.name}
        socialAccounts={context?.socialAccounts ?? []}
        initial={services.speak}
        assistants={assistants}
        assistant={agent ? { id: agent.id, name: agent.name, firstMessage: agent.firstMessage ?? '', language: agent.language } : null}
      />
    </ServicesShell>
  )
}
