import { listAssistants } from '@/actions/assistants'
import { getBusinessServices } from '@/lib/services/serviceConfig'
import { canSendEmail } from '@/lib/email/sendEmail'
import { loadServicesContext } from '../_lib/servicesContext'
import { ServicesShell } from '../_components/ServicesShell'
import { FormConfigurator } from './_components/FormConfigurator'

export default async function FormServicePage() {
  const { business, user } = await loadServicesContext()
  const [services, assistants, emailReady] = await Promise.all([
    getBusinessServices(business.workspaceId),
    listAssistants(),
    canSendEmail(user.id),
  ])
  const agent = services.form.agent

  return (
    <ServicesShell title="Form">
      <FormConfigurator
        mode="service"
        roomName={business.roomName}
        initial={services.form}
        assistants={assistants}
        assistant={agent ? { id: agent.id, name: agent.name } : null}
        emailReady={emailReady}
      />
    </ServicesShell>
  )
}
