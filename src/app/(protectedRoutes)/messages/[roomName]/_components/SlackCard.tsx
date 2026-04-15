'use client'

import { useTransition, useState } from 'react'
import { ChannelStatus, MessageChannel } from '@prisma/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { connectSlack, disconnectSlack } from '@/actions/messages'
import { Loader2, Copy, Check } from 'lucide-react'

type Props = {
  roomName: string
  channel: MessageChannel | null
}

export const SlackCard = ({ roomName, channel }: Props) => {
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)
  const isActive = channel?.status === ChannelStatus.ACTIVE

  const webhookUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhook/slack/${encodeURIComponent(roomName)}`

  const handleConnect = (formData: FormData) => {
    const token = formData.get('botToken') as string
    const teamId = formData.get('teamId') as string
    if (!token) return

    startTransition(async () => {
      await connectSlack(roomName, token, teamId || '')
    })
  }

  const handleDisconnect = () => {
    startTransition(async () => {
      await disconnectSlack(roomName)
    })
  }

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">
        Connect a Slack bot to handle messages in your workspace channels.
      </p>

      {isActive && (
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs text-muted-foreground mb-1 font-medium">Webhook URL</p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-background px-2 py-1 rounded flex-1 break-all">
              {webhookUrl}
            </code>
            <Button variant="ghost" size="sm" onClick={copyWebhook}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Paste in Slack App → Event Subscriptions → Request URL.
            Subscribe to: <span className="font-medium">message.channels</span> and <span className="font-medium">message.im</span>
          </p>
        </div>
      )}

      {!isActive && (
        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Setup steps:</p>
          <p>1. Go to api.slack.com/apps → Create New App</p>
          <p>2. OAuth & Permissions → Bot Token Scopes: chat:write, channels:history, im:history</p>
          <p>3. Install to workspace → copy Bot User OAuth Token</p>
        </div>
      )}

      <form className="flex flex-col gap-2" action={handleConnect}>
        <Input
          name="botToken"
          type="password"
          placeholder="Bot User OAuth Token (xoxb-…)"
          disabled={isPending}
        />
        <Input
          name="teamId"
          type="text"
          placeholder="Team/Workspace ID (optional)"
          disabled={isPending}
        />
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
            {isActive ? 'Update' : 'Connect'}
          </Button>
          {isActive && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={handleDisconnect}
            >
              Disconnect
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
