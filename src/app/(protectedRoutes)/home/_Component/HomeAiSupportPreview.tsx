'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Orb } from '@/components/ui/orb'
import { HOME_AI_CHAT_OUTER_CLASS } from './homeAiSupportPreview.constants'

const ChatClient = dynamic(
  () =>
    import('@/app/(publicRoutes)/chat/[roomName]/_components/ChatClient').then(
      (m) => m.ChatClient,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className={`${HOME_AI_CHAT_OUTER_CLASS} animate-pulse bg-muted/20`}
        aria-hidden
      />
    ),
  },
)

export type HomeAiSupportSocial = { platform: string; label: string; url?: string }

export type HomeAiSupportPreviewProps =
  | { state: 'empty' }
  | {
      state: 'ready'
      roomName: string
      agentName: string
      businessName: string
      firstMessage: string
      socialAccounts: HomeAiSupportSocial[]
    }

export function HomeAiSupportPreview(props: HomeAiSupportPreviewProps) {
  if (props.state === 'empty') {
    return (
      <div className="flex min-h-[280px] w-full flex-col items-center justify-center gap-4 rounded-xl bg-background p-6">
        <div className="h-28 w-28 overflow-hidden rounded-full border border-primary/20 bg-background">
          <Orb colors={['#79b8ff', '#9ddfca']} resizeDebounce={0} className="h-full w-full" />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Create a business and link an AI agent to mirror your live chat room here.
        </p>
        <Link
          href="/ai-agents"
          className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          Create AI support agent
        </Link>
      </div>
    )
  }

  const { roomName, agentName, businessName, firstMessage, socialAccounts } = props

  return (
    <div className={HOME_AI_CHAT_OUTER_CLASS}>
      <ChatClient
        roomName={roomName}
        agentName={agentName}
        businessName={businessName}
        firstMessage={firstMessage}
        socialAccounts={socialAccounts}
        embedMode
        defaultTab="voice"
      />
    </div>
  )
}
