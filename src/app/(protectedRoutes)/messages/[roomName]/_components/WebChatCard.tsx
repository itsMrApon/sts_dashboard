'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check, ExternalLink } from 'lucide-react'

type Props = {
  roomName: string
}

export const WebChatCard = ({ roomName }: Props) => {
  const [copied, setCopied] = useState(false)

  const chatUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/chat/${encodeURIComponent(roomName)}`

  const copyLink = () => {
    navigator.clipboard.writeText(chatUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">
        Share this link with anyone — they can chat with your AI directly in their browser. No setup needed.
      </p>

      <div className="rounded-lg bg-muted p-3">
        <p className="text-xs text-muted-foreground mb-1 font-medium">Shareable link</p>
        <div className="flex items-center gap-2">
          <code className="text-xs bg-background px-2 py-1 rounded flex-1 break-all">
            {chatUrl}
          </code>
          <Button variant="ghost" size="sm" onClick={copyLink}>
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      <a
        href={chatUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Button variant="outline" size="sm" className="gap-1">
          <ExternalLink className="h-3 w-3" />
          Open Chat
        </Button>
      </a>
    </div>
  )
}
