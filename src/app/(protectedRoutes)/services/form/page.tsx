import { listAssistants } from '@/actions/assistants'
import { getBusinessServices } from '@/lib/services/serviceConfig'
import { isSmtpConfigured } from '@/lib/services/formSubmit'
import { loadServicesContext } from '../_lib/servicesContext'
import { ServicesShell } from '../_components/ServicesShell'
import { FormConfigurator } from './_components/FormConfigurator'

export default async function FormServicePage() {
  const { business } = await loadServicesContext()
  const [services, assistants] = await Promise.all([getBusinessServices(business.workspaceId), listAssistants()])
  const agent = services.form.agent

  return (
    <ServicesShell title="Form">
      <FormConfigurator
        mode="service"
        roomName={business.roomName}
        initial={services.form}
        assistants={assistants}
        assistant={agent ? { id: agent.id, name: agent.name } : null}
        emailReady={isSmtpConfigured()}
      />
    </ServicesShell>
  )
}
