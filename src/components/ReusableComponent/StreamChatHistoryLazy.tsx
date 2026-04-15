'use client'

import dynamic from 'next/dynamic'

const StreamChatHistory = dynamic(
  () => import('@/components/ReusableComponent/StreamChatHistory'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[400px] flex items-center justify-center text-muted-foreground">
        Loading chat…
      </div>
    ),
  }
)

export default StreamChatHistory
