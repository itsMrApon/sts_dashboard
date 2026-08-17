'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Flame,
  MessageCircle,
  Package,
  Plug,
  ShoppingBag,
  Workflow,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AnimatedAIChat } from '@/components/ui/animated-ai-chat'
import type { Message } from '@/components/ui/chat-message'
import {
  extractPartnerPrefixes,
  PARTNER_SLASH_COMMANDS,
  resolvePartnerServices,
} from '@/lib/partners/slashCommands'

type PendingProposal = {
  id: string
  summary: string
  tools: Array<{
    name: string
    args: Record<string, unknown>
    connectorKind: string
    connectorLabel: string
    description: string
  }>
}

export type ConnectedPartnerOption = {
  id: string
  kind: string
  label: string
}

type Props = {
  tenantId: string
  connectedPartners?: ConnectedPartnerOption[]
}

const COMMAND_ICONS: Record<string, ReactNode> = {
  medusa: <ShoppingBag className="h-4 w-4" />,
  n8n: <Workflow className="h-4 w-4" />,
  erpnext: <Package className="h-4 w-4" />,
  chatwoot: <MessageCircle className="h-4 w-4" />,
  firecrawl: <Flame className="h-4 w-4" />,
  custom: <Plug className="h-4 w-4" />,
}

export function TenantChatView({ tenantId, connectedPartners = [] }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [pendingProposal, setPendingProposal] = useState<PendingProposal | null>(null)
  const [lastServices, setLastServices] = useState<string[]>([])
  const sessionId = useMemo(() => crypto.randomUUID(), [tenantId])

  useEffect(() => {
    setMessages([])
    setInput('')
    setPendingProposal(null)
    setLastServices([])
  }, [tenantId])

  const commands = useMemo(
    () =>
      PARTNER_SLASH_COMMANDS.map((command) => ({
        ...command,
        icon: COMMAND_ICONS[command.serviceKind] ?? <Plug className="h-4 w-4" />,
      })),
    [],
  )

  const sendMessage = useCallback(
    async (text: string) => {
      const message = text.trim()
      if (!message || message === '/' || isGenerating || !tenantId) return

      const prefixes = extractPartnerPrefixes(message)
      const resolved = resolvePartnerServices({
        prefixes,
        connectedPartners,
      })
      const services = resolved.length > 0 ? resolved : lastServices
      if (resolved.length > 0) setLastServices(resolved)

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        createdAt: new Date(),
      }
      const nextMessages = [...messages, userMsg]
      setMessages(nextMessages)
      setInput('')
      setIsGenerating(true)
      setPendingProposal(null)

      try {
        const history = nextMessages
          .slice(0, -1)
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

        const res = await fetch('/api/tenants/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            services,
            message,
            sessionId,
            history,
          }),
        })

        const data = (await res.json()) as {
          reply?: string
          error?: string
          pendingProposal?: PendingProposal | null
        }

        if (!res.ok) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: data.error || 'Assistant request failed',
              createdAt: new Date(),
            },
          ])
          return
        }

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.reply || '',
            createdAt: new Date(),
          },
        ])
        setPendingProposal(data.pendingProposal ?? null)
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Could not reach the assistant. Check your connection and try again.',
            createdAt: new Date(),
          },
        ])
      } finally {
        setIsGenerating(false)
      }
    },
    [connectedPartners, isGenerating, lastServices, messages, sessionId, tenantId],
  )

  const resolveProposal = useCallback(
    async (action: 'confirm' | 'cancel') => {
      if (!pendingProposal || isGenerating || !tenantId) return
      setIsGenerating(true)

      try {
        const history = messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
        const lastUser = [...messages].reverse().find((m) => m.role === 'user')
        const prefixes = extractPartnerPrefixes(
          [input, lastUser?.content || ''].filter(Boolean).join('\n'),
        )
        const resolved = resolvePartnerServices({
          prefixes,
          connectedPartners,
        })
        const services = resolved.length > 0 ? resolved : lastServices

        const res = await fetch('/api/tenants/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            services,
            sessionId,
            history,
            ...(action === 'confirm'
              ? { confirmProposalId: pendingProposal.id }
              : { cancelProposalId: pendingProposal.id }),
          }),
        })

        const data = (await res.json()) as { reply?: string; error?: string }

        if (!res.ok) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: data.error || 'Failed to resolve proposal',
              createdAt: new Date(),
            },
          ])
          return
        }

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.reply || (action === 'cancel' ? 'Cancelled.' : 'Done.'),
            createdAt: new Date(),
          },
        ])
        setPendingProposal(null)
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Could not resolve the proposal. Try again.',
            createdAt: new Date(),
          },
        ])
      } finally {
        setIsGenerating(false)
      }
    },
    [connectedPartners, input, isGenerating, lastServices, messages, pendingProposal, sessionId, tenantId],
  )

  if (!tenantId) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
        Create a Messages room first, then chat with partners.
      </div>
    )
  }

  return (
    <AnimatedAIChat
      value={input}
      onValueChange={setInput}
      onSend={() => void sendMessage(input)}
      isTyping={isGenerating}
      commands={commands}
      messages={messages}
      placeholder="Ask with /medusa, /ecommerce, /n8n, /automate…"
      footer={
        pendingProposal ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
            <p className="text-sm font-medium text-foreground">Confirm partner action</p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {pendingProposal.tools.map((tool) => (
                <li key={`${tool.name}-${tool.connectorKind}`}>
                  <span className="font-medium text-foreground">{tool.connectorLabel}</span>
                  {': '}
                  {tool.description}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={isGenerating}
                onClick={() => void resolveProposal('confirm')}
              >
                Confirm & run
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isGenerating}
                onClick={() => void resolveProposal('cancel')}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null
      }
    />
  )
}
