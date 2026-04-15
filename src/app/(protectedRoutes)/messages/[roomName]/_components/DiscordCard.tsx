'use client'

import { useTransition } from 'react'
import { ChannelStatus, MessageChannel } from '@prisma/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { connectDiscord, disconnectDiscord } from '@/actions/messages'

type Props = {
  roomName: string
  channel: MessageChannel | null
}

export const DiscordCard = ({ roomName, channel }: Props) => {
  const [isPending, startTransition] = useTransition()

  const handleConnect = (formData: FormData) => {
    const botToken = formData.get('botToken') as string
    const publicKey = formData.get('publicKey') as string
    if (!botToken || !publicKey) return

    startTransition(async () => {
      await connectDiscord(roomName, botToken, publicKey)
    })
  }

  const handleDisconnect = () => {
    startTransition(async () => {
      await disconnectDiscord(roomName)
    })
  }

  const isActive = channel?.status === ChannelStatus.ACTIVE

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">
        Connect a Discord application to handle interactions via a single webhook endpoint. This
        uses signature verification with the app&apos;s public key.
      </p>

      <form className="flex flex-col gap-2" action={handleConnect}>
        <Input
          name="botToken"
          type="password"
          placeholder="Bot token"
          disabled={isPending}
        />
        <Input
          name="publicKey"
          type="text"
          placeholder="Public key (for signature verification)"
          disabled={isPending}
        />
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={isPending}>
            {isActive ? 'Update connection' : 'Connect app'}
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

