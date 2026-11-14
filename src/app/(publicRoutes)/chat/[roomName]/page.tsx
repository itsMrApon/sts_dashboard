import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { buildAgentContext } from '@/lib/messages/buildAgentContext'
import { loadPublicBusiness, serviceAccess } from '@/lib/public/publicService'
import { PublicServiceShell, ServiceUnavailable } from '../../_components/PublicServiceShell'
import { ChatRoom } from './_components/ChatRoom'

type Props = { params: Promise<{ roomName: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { roomName } = await params
  const loaded = await loadPublicBusiness(decodeURIComponent(roomName))
  if (!loaded) return { title: 'Chat', robots: { index: false } }
  return {
    title: `Chat with ${loaded.business.name}`,
    description: loaded.services.chat.config.greeting,
  }
}

/** Chat service: text chat with the business AI. */
export default async function ChatServicePage({ params }: Props) {
  const { roomName } = await params
  const loaded = await loadPublicBusiness(decodeURIComponent(roomName))
  if (!loaded) notFound()

  const access = serviceAccess(loaded, 'chat')
  const { config } = loaded.services.chat
  // "Talk to a person" needs the business's contacts; the light homePreview mode skips the prompt build.
  const context =
    access !== 'off' && config.showHumanHandoff
      ? await buildAgentContext(loaded.business.roomName, { mode: 'homePreview' })
      : null
  return (
    <PublicServiceShell
      businessName={loaded.business.name}
      service="chat"
      links={loaded.links}
      ownerPreview={access === 'owner-preview'}
    >
      {access === 'off' ? (
        <ServiceUnavailable title="Chat isn't available right now" detail={`Please check back later or contact ${loaded.business.name}.`} />
      ) : (
        <ChatRoom
          roomName={loaded.business.roomName}
          agentName={loaded.agent.name}
          config={config}
          isOwner={loaded.isOwner}
          socialAccounts={context?.socialAccounts ?? []}
        />
      )}
    </PublicServiceShell>
  )
}
