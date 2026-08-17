import Link from 'next/link'
import { Hash } from 'lucide-react'
import { getTenantById } from '@/actions/tenants'
import { timeAsync } from '@/lib/dev/perf'
import { getRoomPageDataCached } from '../_lib/getRoomPageData'
import type { RoomCardData } from './RoomCard'
import { PublishWorkspaceShell } from './PublishWorkspaceShell'
import { publishPlatformGroups } from './publishPlatforms'

type Props = {
  room: RoomCardData
  userId: string
}

const { socialPlatforms, messagingPlatforms, otherPlatforms } = publishPlatformGroups()

export async function PublishRoomSection({ room, userId }: Props) {
  const primaryAgent = room.agents.find((a) => a.isPrimary) || room.agents[0]
  const roomName = primaryAgent?.agent.roomName ?? room.channels[0]?.roomName ?? null

  if (!roomName) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
        This room has no messaging room name yet, so business details cannot be published.
      </div>
    )
  }

  const roomData = await timeAsync(`messages.publish.${roomName}`, () =>
    getRoomPageDataCached(userId, roomName, primaryAgent?.agent.id ?? null),
  )

  const workspaceId = roomData.currentWorkspace?.id
  if (!workspaceId) {
    return (
      <article className="w-full min-w-0 rounded-2xl border border-border bg-card p-8">
        <h2 className="text-base font-semibold">{room.name}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This room is not attached to a workspace yet. Attach one in{' '}
          <Link
            href={`/messages/voice?room=${encodeURIComponent(roomName)}`}
            className="font-medium text-primary underline"
          >
            Voice AI
          </Link>{' '}
          — Publish uses that workspace&apos;s business details.
        </p>
      </article>
    )
  }

  const tenant = await getTenantById(workspaceId, userId)
  if (!tenant?.publishProfileId) {
    return (
      <article className="w-full min-w-0 rounded-2xl border border-border bg-card p-8">
        <h2 className="text-base font-semibold">{room.name}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Workspace <span className="font-medium text-foreground">{tenant?.name || workspaceId}</span>{' '}
          has no publish profile yet. Recreate or link publish from Workspaces, then return here.
        </p>
      </article>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <Hash className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate font-mono">{roomName}</span>
        <span aria-hidden>·</span>
        <span className="truncate">
          Publishing {roomData.currentWorkspace?.publishName || tenant.name}
        </span>
      </div>
      <PublishWorkspaceShell
        workspaceId={tenant.id}
        workspaceName={tenant.name}
        tenant={{
          ...tenant,
          publishProfile: tenant.publishProfile
            ? { id: tenant.publishProfile.id, name: tenant.publishProfile.name }
            : null,
          contextStatus: tenant.contextStatus || 'DRAFT',
          contextVersion: tenant.contextVersion || null,
          compactTokenEstimate: tenant.compactTokenEstimate || 0,
          contextVertical: tenant.contextVertical || null,
          contextCoreJson: tenant.contextCoreJson || {},
          contextIndustryJson: tenant.contextIndustryJson || {},
          contextSocialJson: tenant.contextSocialJson || {},
          compactProfileJson: tenant.compactProfileJson || null,
        }}
        socialPlatforms={socialPlatforms}
        messagingPlatforms={messagingPlatforms}
        otherPlatforms={otherPlatforms}
        backHref={`/messages/voice?room=${encodeURIComponent(roomName)}`}
        backLabel="Voice AI"
        roomName={roomName}
      />
    </div>
  )
}
