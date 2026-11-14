import { prismaClient } from '@/lib/prismaClient'
import { getBusinessServices } from '@/lib/services/serviceConfig'
import { loadMessagesContext } from '../_lib/messagesContext'
import { MessagesShell } from '../_components/MessagesShell'
import { ChatConfigurator } from './_components/ChatConfigurator'

export default async function ChatAiPage() {
  const { business } = await loadMessagesContext()
  const [services, agent] = await Promise.all([
    getBusinessServices(business.workspaceId),
    prismaClient.liveKitAgent.findUnique({ where: { id: business.agentId }, select: { name: true } }),
  ])

  return (
    <MessagesShell
      businessName={business.name}
      title="Chat AI"
      description="Text chat with your business AI. Your website designer builds the chat box; the SDK handles the conversation."
    >
      <ChatConfigurator roomName={business.roomName} agentName={agent?.name || business.name} initial={services.chat} />
    </MessagesShell>
  )
}
