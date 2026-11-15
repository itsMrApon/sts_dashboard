import { getBusinessServices } from '@/lib/services/serviceConfig'
import { isSmtpConfigured } from '@/lib/services/formSubmit'
import { loadMessagesContext } from '../_lib/messagesContext'
import { MessagesShell } from '../_components/MessagesShell'
import { FormConfigurator } from './_components/FormConfigurator'

export default async function FormServicePage() {
  const { business, user } = await loadMessagesContext()
  const services = await getBusinessServices(business.workspaceId)

  return (
    <MessagesShell
      businessName={business.name}
      title="Form"
      description="A one-question-at-a-time form. Every answer is emailed to you; nothing is stored."
    >
      <FormConfigurator
        roomName={business.roomName}
        initial={services.form}
        ownerEmail={user.email ?? ''}
        emailReady={isSmtpConfigured()}
      />
    </MessagesShell>
  )
}
