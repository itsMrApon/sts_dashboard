'use client'

import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { Toaster } from 'sonner'
import { createStsAiClient } from './client'
import type { EmbedBootstrap, StsAiRoomProps } from './types'

type ChatClientComponent = ComponentType<{
  embedClient: ReturnType<typeof createStsAiClient>
  roomName: string
  agentName: string
  businessName: string
  firstMessage: string
  socialAccounts: EmbedBootstrap['socialAccounts']
  embedMode?: boolean
  defaultTab?: 'chat' | 'voice' | 'mobile'
}>

export function StsAiRoom({
  apiBase,
  siteKey,
  roomName,
  embedMode = true,
  defaultTab = 'voice',
  className,
  loadingFallback,
  onReady,
}: StsAiRoomProps) {
  const client = useMemo(
    () => createStsAiClient({ apiBase, siteKey, roomName }),
    [apiBase, siteKey, roomName],
  )

  const [bootstrap, setBootstrap] = useState<EmbedBootstrap | null>(null)
  const [ChatClient, setChatClient] = useState<ChatClientComponent | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      client.bootstrap(),
      import('./room/ChatClient'),
    ])
      .then(([data, mod]) => {
        if (cancelled) return
        setBootstrap(data)
        setChatClient(() => mod.ChatClient as ChatClientComponent)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load room')
        }
      })

    return () => {
      cancelled = true
    }
  }, [client])

  useEffect(() => {
    if (bootstrap && ChatClient) {
      onReadyRef.current?.()
    }
  }, [bootstrap, ChatClient])

  if (loadError) {
    return (
      <div
        className={`sts-ai-root flex h-full min-h-[480px] items-center justify-center p-6 text-center text-sm text-destructive ${className ?? ''}`.trim()}
      >
        {loadError}
      </div>
    )
  }

  if (!bootstrap || !ChatClient) {
    const showDefaultMessage = loadingFallback === undefined
    return (
      <div
        className={`sts-ai-root ${
          showDefaultMessage
            ? 'flex h-full min-h-[480px] items-center justify-center p-6 text-sm text-muted-foreground'
            : 'pointer-events-none min-h-[480px] bg-transparent'
        } ${className ?? ''}`.trim()}
        aria-busy="true"
        aria-hidden={!showDefaultMessage}
      >
        {showDefaultMessage ? 'Loading AI room…' : loadingFallback}
      </div>
    )
  }

  return (
    <div className={`sts-ai-root h-full min-h-[480px] ${className ?? ''}`.trim()}>
      <Toaster position="top-center" richColors closeButton />
      <ChatClient
        embedClient={client}
        roomName={roomName}
        agentName={bootstrap.agentName}
        businessName={bootstrap.businessName}
        firstMessage={bootstrap.firstMessage}
        socialAccounts={bootstrap.socialAccounts}
        embedMode={embedMode}
        defaultTab={defaultTab}
      />
    </div>
  )
}
