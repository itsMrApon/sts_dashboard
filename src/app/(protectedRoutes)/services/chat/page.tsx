import { listAssistants } from '@/actions/assistants'
import { buildAgentContext } from '@/lib/messages/buildAgentContext'
import { getBusinessServices } from '@/lib/services/serviceConfig'
import { loadServicesContext } from '../_lib/servicesContext'
import { ServicesShell } from '../_components/ServicesShell'
import { ChatConfigurator } from './_components/ChatConfigurator'

export default async function ChatAiPage() {
  const { business } = await loadServicesContext()
  const [services, assistants] = await Promise.all([getBusinessServices(business.workspaceId), listAssistants()])
  // "Talk to a person" in the live view needs the business's contacts (light homePreview build).
  const context = services.chat.config.showHumanHandoff
    ? await buildAgentContext(business.roomName, { mode: 'homePreview' })
    : null

  return (
    <ServicesShell title="Chat AI">
      <ChatConfigurator
        mode="service"
        roomName={business.roomName}
        businessName={business.name}
        socialAccounts={context?.socialAccounts ?? []}
        initial={services.chat}
        assistants={assistants}
        assistant={services.chat.agent ? { id: services.chat.agent.id, name: services.chat.agent.name } : null}
      />
    </ServicesShell>
  )
}
