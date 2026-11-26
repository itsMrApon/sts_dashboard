'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { CurvedPanel, MenuToggle } from '@/components/ui/curved-menu'
import { listInboxAction } from '@/actions/messages'
import type { InboxThread } from '@/lib/messages/inbox'
import type { PartnerAssistantInfo } from '@/actions/messages'
import { MessageInbox } from './MessageInbox'
import { NEW_PARTNER_CHAT, OPEN_MESSAGES_EVENT } from './openMessages'

/** The query parameter a link uses to open the panel: `?inbox=1`, or `?inbox=<conversation>`. */
const PARAM = 'inbox'

/**
 * Messages, top right on every page: a small purple button with the number of people waiting,
 * opening every conversation (WhatsApp, Instagram, website, project chats, email) in a curved
 * panel. The AI only writes drafts there; the creator sends.
 */
export function MessagesButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const [startId, setStartId] = useState<string | null>(null)
  const [startNewChat, setStartNewChat] = useState(false)
  const [data, setData] = useState<{
    threads: InboxThread[]
    canEmail: boolean
    partnerAssistant: PartnerAssistantInfo | null
  } | null>(null)
  const [waiting, setWaiting] = useState(0)
  const toggleRef = useRef<HTMLButtonElement>(null)

  const load = useCallback(async () => {
    const res = await listInboxAction().catch(() => null)
    if (!res?.ok) return
    setData(res.data)
    setWaiting(res.data.threads.filter((t) => t.needsReply).length)
  }, [])

  const show = useCallback((threadId?: string | null) => {
    const newChat = threadId === NEW_PARTNER_CHAT
    setStartNewChat(newChat)
    setStartId(threadId && threadId !== '1' && !newChat ? threadId : null)
    setOpen(true)
  }, [])

  // A link with ?inbox=… opens the panel; other parts of the app can open it with openMessages().
  useEffect(() => {
    void load()
    const fromUrl = new URLSearchParams(window.location.search).get(PARAM)
    if (fromUrl) show(fromUrl)
    const onOpen = (event: Event) => show((event as CustomEvent<string | undefined>).detail ?? null)
    window.addEventListener(OPEN_MESSAGES_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_MESSAGES_EVENT, onOpen)
  }, [load, show])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  function close() {
    setOpen(false)
    const url = new URL(window.location.href)
    if (url.searchParams.has(PARAM)) {
      url.searchParams.delete(PARAM)
      window.history.replaceState(window.history.state, '', url)
    }
    void load()
  }

  return (
    <>
      <MenuToggle
        ref={toggleRef}
        active={open}
        onClick={() => (open ? close() : show(null))}
        label={waiting ? `Messages, ${waiting} waiting for you` : 'Messages'}
        className={className}
      />

      <CurvedPanel open={open} onClose={close} title="Messages" anchor={toggleRef}>
        {data ? (
          <MessageInbox
            threads={data.threads}
            canEmail={data.canEmail}
            partnerAssistant={data.partnerAssistant}
            onRefresh={() => void load()}
            initialOpenId={startId}
            startNewChat={startNewChat}
            urlParam={PARAM}
            className="h-full min-h-0"
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center">
            <Loader2 className="size-4 animate-spin" aria-label="Loading conversations" />
          </div>
        )}
      </CurvedPanel>
    </>
  )
}
