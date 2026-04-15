'use client'

import { Channel as StreamChannel, StreamChat } from 'stream-chat'
import { Chat, Channel, MessageInput, MessageList } from 'stream-chat-react'
import 'stream-chat-react/dist/css/v2/index.css'

type Props = {
  client: StreamChat
  channel: StreamChannel
}

export default function MiniStreamChat({ client, channel }: Props) {
  return (
    <>
      <Chat client={client}>
        <Channel channel={channel}>
          <div className="flex h-full flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <MessageList />
            </div>
            <div className="border-t border-border bg-card/95">
              <MessageInput />
            </div>
          </div>
        </Channel>
      </Chat>
      <style jsx global>{`
        .str-chat {
          width: 100% !important;
          height: 100% !important;
        }
        .str-chat__container {
          width: 100% !important;
          max-width: 100% !important;
          height: 100% !important;
        }
        /* Force single-column layout, no reserved space for thread/aside */
        .str-chat__layout,
        .str-chat__main-panel {
          display: block !important;
          width: 100% !important;
          grid-template-columns: minmax(0, 1fr) !important;
        }
        .str-chat__thread,
        .str-chat__aside {
          display: none !important;
          width: 0 !important;
          max-width: 0 !important;
        }
        .str-chat__list {
          padding-left: 0 !important;
          padding-right: 0 !important;
        }
      `}</style>
    </>
  )
}

