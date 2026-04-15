import { prismaClient } from '@/lib/prismaClient'
import { ChatRoomView } from './_components/ChatRoomView'
import { buildAgentContext } from '@/lib/messages/buildAgentContext'

type Props = {
  params: Promise<{ roomName: string }>
}

const page = async ({ params }: Props) => {
  const { roomName } = await params

  const agent = await prismaClient.liveKitAgent.findUnique({
    where: { roomName },
  })

  if (!agent) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Chat not found</h1>
          <p className="text-muted-foreground mt-2">This room doesn&apos;t exist or has been removed.</p>
        </div>
      </div>
    )
  }

  const context = await buildAgentContext(roomName, { preloadedAgent: agent })

  return (
    <ChatRoomView
      roomName={roomName}
      agentName={agent.name}
      businessName={context.businessName ?? agent.name}
      firstMessage={agent.firstMessage || `Hi! I'm ${agent.name}. How can I help you today?`}
      socialAccounts={context.socialAccounts}
    />
  )
}

export default page
