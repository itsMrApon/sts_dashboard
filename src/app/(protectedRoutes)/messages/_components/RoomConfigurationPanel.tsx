import { Suspense } from 'react'
import Link from 'next/link'
import { Platform, type MessageChannel } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { PlatformCard } from '../[roomName]/_components/PlatformCard'
import { WebChatCard } from '../[roomName]/_components/WebChatCard'
import { EmbedSetupCard } from '../[roomName]/_components/EmbedSetupCard'
import { RoomBusinessLinksEditorLoader } from './RoomBusinessLinksEditorLoader'
import { RoomWorkspaceCard } from './RoomWorkspaceCard'
import { platformChannelStatus } from '../_lib/channelStatus'
import type { RoomPageData } from '../_lib/getRoomPageData'

type AgentSummary = { id: string; name: string; roomName: string } | null

type Props = {
  roomName: string
  agent: AgentSummary
  roomData: RoomPageData
  userId: string
  compact?: boolean
}

function statusLabel(status: 'active' | 'inactive' | 'error'): string {
  if (status === 'active') return 'active'
  if (status === 'error') return 'error'
  return 'off'
}

function ChannelStatusRow({
  roomName,
  channels,
}: {
  roomName: string
  channels: MessageChannel[]
}) {
  const telegram = channels.find((c) => c.platform === Platform.TELEGRAM)
  const discord = channels.find((c) => c.platform === Platform.DISCORD)
  const slack = channels.find((c) => c.platform === Platform.SLACK)
  const connectionsHref = `/messages/connections?room=${encodeURIComponent(roomName)}`

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Platform connections</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={platformChannelStatus(telegram) === 'active' ? 'default' : 'outline'}>
            Telegram {statusLabel(platformChannelStatus(telegram))}
          </Badge>
          <Badge variant={platformChannelStatus(discord) === 'active' ? 'default' : 'outline'}>
            Discord {statusLabel(platformChannelStatus(discord))}
          </Badge>
          <Badge variant={platformChannelStatus(slack) === 'active' ? 'default' : 'outline'}>
            Slack {statusLabel(platformChannelStatus(slack))}
          </Badge>
        </div>
      </div>
      <Link
        href={connectionsHref}
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Manage connections
      </Link>
    </div>
  )
}

export function RoomConfigurationPanel({
  roomName,
  agent,
  roomData,
  userId,
  compact = false,
}: Props) {
  const {
    publishProfile: business,
    channels,
    currentWorkspace,
    workspaces,
  } = roomData

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const roomNameEncoded = encodeURIComponent(roomName)
  const isHomeFeatured = business?.isHomeFeatured ?? false
  const canSetHomeFeatured = Boolean(business && agent)

  return (
    <div className={compact ? 'flex flex-col gap-4' : 'flex flex-col gap-6'}>
      {!compact && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {business
            ? 'Linked projects and agents feed the AI. Share web chat or embed below. Connect Telegram, Discord, or Slack in Connections.'
            : 'Share web chat or embed for this room. Attach a workspace for publish pitch context.'}
        </p>
      )}

      {!agent && (
        <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          No AI agent record exists for this room (it may have been removed). Channel settings below
          still work. To restore chat/voice, create an agent in{' '}
          <Link href="/ai-agents" className="font-medium underline">
            AI Agents
          </Link>{' '}
          and link it to this publish profile.
        </div>
      )}

      <RoomWorkspaceCard
        roomName={roomName}
        currentWorkspace={currentWorkspace}
        workspaces={workspaces}
      />

      {business ? (
        <Suspense fallback={<div className="h-28 w-full rounded-xl bg-muted animate-pulse" />}>
          <RoomBusinessLinksEditorLoader
            userId={userId}
            publishProfile={business}
            roomName={roomName}
          />
        </Suspense>
      ) : null}

      {!compact && <Separator />}

      <ChannelStatusRow roomName={roomName} channels={channels} />

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-foreground">
            Web chat and embed
          </h2>
          <Badge variant="outline">Room</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Public chat link and website embed for this room.
        </p>
      </section>

      <section id={`messaging-setup-${roomNameEncoded}`} className="flex scroll-mt-28 flex-col gap-2">
        <PlatformCard
          title="Web Chat"
          icon={<span className="text-sm font-semibold text-cyan-500">WC</span>}
          status="active"
          description="Share your chat room publicly. No credentials required."
          openLink={`${appUrl}/chat/${roomNameEncoded}`}
          linkLabel="Web chat link"
        >
          <WebChatCard
            roomName={roomName}
            isHomeFeatured={isHomeFeatured}
            canSetHomeFeatured={canSetHomeFeatured}
          />
        </PlatformCard>

        <PlatformCard
          title="Website Embed"
          icon={<span className="text-sm font-semibold text-violet-500">PK</span>}
          status="active"
          description="Install @sts-ai/sudotechserve on your Next.js creator website."
          openLink={`${appUrl}/chat/${roomNameEncoded}?embed=1`}
          linkLabel="Preview room"
        >
          <EmbedSetupCard roomName={roomName} />
        </PlatformCard>
      </section>

      <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">
          Looking to edit website business details for this room? Open{' '}
          <Link
            href={`/messages/publish?room=${encodeURIComponent(roomName)}`}
            className="font-medium text-primary underline"
          >
            Publish
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
