'use client'

import React, { useEffect, useState } from 'react'
import { Channel as StreamChannel, StreamChat } from 'stream-chat'
import { Chat, Channel, MessageList, MessageInput } from 'stream-chat-react'
import 'stream-chat-react/dist/css/v2/index.css'
import { MessageSquare } from 'lucide-react'

type Props = {
  channelId: string
  channelName: string
  userId: string
  userName: string
  userToken: string
}

const StreamChatHistory = ({
  channelId,
  channelName,
  userId,
  userName,
  userToken,
}: Props) => {
  const [client, setClient] = useState<StreamChat | null>(null)
  const [channel, setChannel] = useState<StreamChannel | null>(null)

  useEffect(() => {
    const init = async () => {
      const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY
      if (!apiKey) return

      const chatClient = StreamChat.getInstance(apiKey)
      await chatClient.connectUser(
        {
          id: userId,
          name: userName || 'Guest',
        },
        userToken,
      )

      const ch = chatClient.channel('livestream', channelId, {
        name: channelName,
      })
      await ch.watch()

      setClient(chatClient)
      setChannel(ch)
    }

    void init()

    return () => {
      if (client) {
        client.disconnectUser()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, channelName, userId, userName, userToken])

  if (!client || !channel) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center text-muted-foreground">
        Loading chat...
      </div>
    )
  }

  return (
    <>
      <div className="w-full flex justify-center h-full">
        <div className="w-full max-w-4xl h-full border border-border rounded-2xl overflow-hidden bg-card/80 backdrop-blur-sm shadow-sm">
          <Chat
            client={client}
            theme="str-chat__theme-light str-chat__theme-messaging"
          >
            <Channel channel={channel}>
              <div className="flex flex-col h-full">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 bg-muted/60">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold truncate">
                      Conversation – {channelName}
                    </h2>
                    <p className="text-xs text-muted-foreground truncate">
                      AI & attendee messages for this product.
                    </p>
                  </div>
                </div>
                <span className="hidden sm:inline text-[11px] text-muted-foreground">
                  Newest messages at the bottom
                </span>
              </div>

                <div className="flex-1 min-h-0 bg-background/60 px-4 py-3 overflow-y-auto">
                  <MessageList />
                </div>

                <div className="border-t border-border bg-card/95 px-4 py-2">
                  <MessageInput />
                </div>
              </div>
            </Channel>
          </Chat>
        </div>
      </div>
      <style jsx global>{`
        /* Make Stream chat use a single, full-width column inside our card */
        .str-chat {
          width: 100% !important;
          height: 100% !important;
        }
        .str-chat__container {
          width: 100% !important;
          max-width: 100% !important;
          height: 100% !important;
        }
        .str-chat__layout,
        .str-chat__main-panel {
          display: block !important;
          width: 100% !important;
          grid-template-columns: minmax(0, 1fr) !important;
        }
        /* Hide any side thread / detail panel that would take horizontal space */
        .str-chat__thread,
        .str-chat__aside {
          display: none !important;
          width: 0 !important;
          max-width: 0 !important;
        }
        /* Let our own padding control horizontal spacing */
        .str-chat__list {
          padding-left: 0 !important;
          padding-right: 0 !important;
        }
      `}</style>
    </>
  )
}

export default StreamChatHistory

