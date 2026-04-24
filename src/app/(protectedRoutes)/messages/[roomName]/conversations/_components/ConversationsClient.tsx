'use client'

import { useEffect, useMemo, useState } from 'react'
import { MessageChannel, MessageConversation } from '@prisma/client'
import { ConversationBubble } from '@/components/messages/ConversationBubble'
import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type Props = {
  roomName: string
  agentName: string
  channels: (MessageChannel & { conversations: MessageConversation[] })[]
  activeTab: 'TELEGRAM' | 'DISCORD' | 'MOBILE_SMTP'
}

type StoredMessage = {
  role: 'user' | 'assistant' | 'error'
  content: string
  timestamp?: string
  errorCode?: string
}

const TABS = ['TELEGRAM', 'DISCORD', 'MOBILE_SMTP'] as const
type Tab = (typeof TABS)[number]
const MOBILE_SMTP_LABEL = 'MOBILE_SMTP_CALLBACK'

export const ConversationsClient = ({
  roomName,
  agentName,
  channels,
  activeTab,
}: Props) => {
  const [selectedTab, setSelectedTab] = useState<Tab>(activeTab)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)

  useEffect(() => {
    setSelectedConversationId(null)
  }, [selectedTab])

  const platformChannels = useMemo(
    () => {
      if (selectedTab === 'TELEGRAM') return channels.filter((c) => c.platform === 'TELEGRAM')
      if (selectedTab === 'DISCORD') return channels.filter((c) => c.platform === 'DISCORD')
      if (selectedTab === 'MOBILE_SMTP') {
        return channels.filter((c) => c.accountLabel === MOBILE_SMTP_LABEL)
      }
      return []
    },
    [channels, selectedTab],
  )

  const allConversations = useMemo(
    () =>
      platformChannels.flatMap((c) =>
        c.conversations.map((conv) => ({
          ...conv,
          channelRoomName: c.roomName,
        })),
      ),
    [platformChannels],
  )

  const selectedConversation =
    allConversations.find((c) => c.id === selectedConversationId) || allConversations[0] || null

  const messages: StoredMessage[] = useMemo(() => {
    if (!selectedConversation) return []
    const data = selectedConversation.messages as unknown
    if (!Array.isArray(data)) return []
    return data as StoredMessage[]
  }, [selectedConversation])

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Conversations · {agentName}</p>
          <p className="text-xs text-muted-foreground">@{roomName}</p>
        </div>
      </div>

      <Tabs
        value={selectedTab}
        onValueChange={(value) => setSelectedTab(value as Tab)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-grid">
          {TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {tab === 'MOBILE_SMTP' ? 'MOBILE SMTP' : tab}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4">
            <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1.6fr)] h-[520px]">
              <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col">
                <div className="px-3 py-2 border-b border-border text-xs font-medium text-muted-foreground">
                  {allConversations.length} conversations
                </div>
                <div className="flex-1 overflow-y-auto">
                  {allConversations.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground px-3 text-center">
                      No conversations yet. Messages from this platform will appear here.
                    </div>
                  ) : (
                    <ul className="divide-y divide-border text-sm">
                      {allConversations.map((conv) => (
                        <li
                          key={conv.id}
                          className={cn(
                            'px-3 py-2 cursor-pointer hover:bg-muted/60',
                            selectedConversation?.id === conv.id && 'bg-muted',
                          )}
                          onClick={() => setSelectedConversationId(conv.id)}
                        >
                          <p className="font-medium truncate">{conv.externalId}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Updated{' '}
                            {new Intl.DateTimeFormat(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            }).format(new Date(conv.updatedAt))}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card flex flex-col">
                {selectedConversation ? (
                  <>
                    <div className="px-4 py-2 border-b border-border text-xs text-muted-foreground flex items-center justify-between gap-2">
                      <span className="truncate">{selectedConversation.externalId}</span>
                      <span className="text-[10px] uppercase tracking-wide">
                        {selectedTab === 'MOBILE_SMTP' ? 'mobile smtp' : selectedTab.toLowerCase()}
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                      {messages.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No messages in this thread yet.</p>
                      ) : (
                        messages.map((m, idx) => (
                          <ConversationBubble
                            key={idx}
                            role={m.role}
                            content={m.content}
                            timestamp={m.timestamp}
                            errorCode={m.errorCode}
                          />
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground px-4 text-center">
                    Select a conversation from the list to view its messages.
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

