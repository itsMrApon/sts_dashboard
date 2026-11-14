import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { buildAgentContext } from '@/lib/messages/buildAgentContext'
import { loadPublicBusiness, serviceAccess } from '@/lib/public/publicService'
import { PublicServiceShell, ServiceUnavailable } from '../../_components/PublicServiceShell'
import { SpeakRoom } from './_components/SpeakRoom'

type Props = { params: Promise<{ roomName: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { roomName } = await params
  const loaded = await loadPublicBusiness(decodeURIComponent(roomName))
  if (!loaded) return { title: 'Speak', robots: { index: false } }
  return {
    title: `Talk to ${loaded.business.name}`,
    description: `Start a voice call with ${loaded.business.name}'s AI assistant.`,
  }
}

/** Speak service: a live voice call with the business AI. */
export default async function SpeakServicePage({ params }: Props) {
  const { roomName } = await params
  const loaded = await loadPublicBusiness(decodeURIComponent(roomName))
  if (!loaded) notFound()

  const access = serviceAccess(loaded, 'speak')
  // Social accounts power "Talk to a person"; the light homePreview mode skips the AI prompt build.
  const context = access === 'off' ? null : await buildAgentContext(loaded.business.roomName, { mode: 'homePreview' })

  return (
    <PublicServiceShell
      businessName={loaded.business.name}
      service="speak"
      links={loaded.links}
      ownerPreview={access === 'owner-preview'}
    >
      {access === 'off' || !context ? (
        <ServiceUnavailable title="Voice calls aren't available right now" detail={`Please check back later or contact ${loaded.business.name}.`} />
      ) : (
        <SpeakRoom
          roomName={loaded.business.roomName}
          agentName={loaded.agent.name}
          businessName={loaded.business.name}
          firstMessage={loaded.agent.firstMessage || `Hi! I'm ${loaded.agent.name}. How can I help you today?`}
          config={loaded.services.speak.config}
          socialAccounts={context.socialAccounts}
        />
      )}
    </PublicServiceShell>
  )
}
