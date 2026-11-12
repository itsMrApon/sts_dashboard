import { prismaClient } from '@/lib/prismaClient'
import { describeEngine, engineSpeaksBangla } from '@/lib/agents/engineOptions'
import { getEngineForUser } from '@/lib/agents/engineSettings'
import { getBusinessServices } from '@/lib/services/serviceConfig'
import { loadMessagesContext } from '../_lib/messagesContext'
import { MessagesShell } from '../_components/MessagesShell'
import { SpeakConfigurator } from './_components/SpeakConfigurator'

export default async function SpeakAiPage() {
  const { business } = await loadMessagesContext()
  const [services, agent, engineView] = await Promise.all([
    getBusinessServices(business.workspaceId),
    prismaClient.liveKitAgent.findUnique({
      where: { id: business.agentId },
      select: { language: true, firstMessage: true },
    }),
    getEngineForUser(business.userId),
  ])
  const engineSummary = describeEngine(engineView.engine, engineView.voiceLabel)

  return (
    <MessagesShell
      businessName={business.name}
      title="Speak AI"
      description="Real-time voice conversations with your business AI. Your designer builds the call button; the SDK handles the call."
    >
      <SpeakConfigurator
        roomName={business.roomName}
        initial={services.speak}
        voiceLabel={`${engineSummary.voice} · ${engineSummary.voiceProvider}`}
        voiceSpeaksBangla={engineSpeaksBangla(engineView.engine)}
        initialVoice={{
          language: agent?.language === 'bn' ? 'bn' : 'en',
          firstMessage: agent?.firstMessage ?? '',
        }}
      />
    </MessagesShell>
  )
}
