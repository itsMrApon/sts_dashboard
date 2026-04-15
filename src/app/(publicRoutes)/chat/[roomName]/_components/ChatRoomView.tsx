'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'

const ChatClient = dynamic(() => import('./ChatClient').then((m) => m.ChatClient), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div
        className="h-[490px] w-full max-w-[430px] animate-pulse rounded-[28px] bg-muted/20"
        aria-hidden
      />
    </div>
  ),
})

export type ChatRoomViewProps = ComponentProps<typeof ChatClient>

export function ChatRoomView(props: ChatRoomViewProps) {
  return <ChatClient {...props} />
}
