import { Platform, type MessageChannel } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import { PlatformCard } from '../[roomName]/_components/PlatformCard'
import { TelegramCard } from '../[roomName]/_components/TelegramCard'
import { DiscordCard } from '../[roomName]/_components/DiscordCard'
import { SlackCard } from '../[roomName]/_components/SlackCard'
import { platformChannelStatus } from '../_lib/channelStatus'

type Props = {
  roomName: string
  channels: MessageChannel[]
}

export function RoomConnectionsPanel({ roomName, channels }: Props) {
  const telegram = channels.find((c) => c.platform === Platform.TELEGRAM)
  const discord = channels.find((c) => c.platform === Platform.DISCORD)
  const slack = channels.find((c) => c.platform === Platform.SLACK)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const roomNameEncoded = encodeURIComponent(roomName)

  return (
    <div className="flex flex-col gap-6">
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-foreground">
            Platform connections
          </h2>
          <Badge variant="outline">Telegram · Discord · Slack</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Attach bots to this room. Incoming messages are answered by this room&apos;s AI agent.
        </p>
      </section>

      <section
        id={`messaging-setup-${roomNameEncoded}`}
        className="flex scroll-mt-28 flex-col gap-2"
      >
        <PlatformCard
          title="Telegram"
          icon={<span className="text-sm font-semibold text-sky-500">TG</span>}
          status={platformChannelStatus(telegram)}
          description="Connect your Telegram bot and validate webhook health."
          openLink={`${appUrl}/api/webhook/telegram/${roomNameEncoded}`}
          linkLabel="Telegram webhook URL"
        >
          <TelegramCard roomName={roomName} channel={telegram || null} />
        </PlatformCard>

        <PlatformCard
          title="Discord"
          icon={<span className="text-sm font-semibold text-indigo-500">DC</span>}
          status={platformChannelStatus(discord)}
          description="Configure Discord bot token and public key verification."
          openLink={`${appUrl}/api/webhook/discord/${roomNameEncoded}`}
          linkLabel="Discord webhook URL"
        >
          <DiscordCard roomName={roomName} channel={discord || null} />
        </PlatformCard>

        <PlatformCard
          title="Slack"
          icon={<span className="text-sm font-semibold text-amber-500">SL</span>}
          status={platformChannelStatus(slack)}
          description="Connect Slack bot token and workspace settings."
          openLink={`${appUrl}/api/webhook/slack/${roomNameEncoded}`}
          linkLabel="Slack webhook URL"
        >
          <SlackCard roomName={roomName} channel={slack || null} />
        </PlatformCard>
      </section>
    </div>
  )
}
