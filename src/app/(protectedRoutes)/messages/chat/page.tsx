import { getBusinessServices } from '@/lib/services/serviceConfig'
import { loadMessagesContext } from '../_lib/messagesContext'
import { MessagesShell } from '../_components/MessagesShell'
import { ChatConfigurator } from './_components/ChatConfigurator'

export default async function ChatAiPage() {
  const { business } = await loadMessagesContext()
  const services = await getBusinessServices(business.workspaceId)

  return (
    <MessagesShell
      businessName={business.name}
      title="Chat AI"
      description="Text chat with your business AI. Your website designer builds the chat box; the SDK handles the conversation."
    >
      <ChatConfigurator roomName={business.roomName} initial={services.chat} />
    </MessagesShell>
  )
}
