import { Hash } from 'lucide-react'
import { timeAsync } from '@/lib/dev/perf'
import { getRoomPageDataCached } from '../_lib/getRoomPageData'
import type { RoomCardData } from './RoomCard'
import { RoomConnectionsPanel } from './RoomConnectionsPanel'

type Props = {
  room: RoomCardData
  userId: string
}

export async function ConnectionsRoomSection({ room, userId }: Props) {
  const primaryAgent = room.agents.find((a) => a.isPrimary) || room.agents[0]
  const roomName = primaryAgent?.agent.roomName ?? room.channels[0]?.roomName ?? null

  if (!roomName) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
        This room has no messaging room name yet, so bots cannot be attached.
      </div>
    )
  }

  const roomData = await timeAsync(`messages.connections.${roomName}`, () =>
    getRoomPageDataCached(userId, roomName, primaryAgent?.agent.id ?? null),
  )

  return (
    <article className="w-full min-w-0 rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-1 border-b border-border/70 px-4 py-4 sm:px-5">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Room
        </p>
        <h2 className="text-base font-semibold leading-snug text-foreground">{room.name}</h2>
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <Hash className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate font-mono">{roomName}</span>
        </p>
        <p className="pt-1 text-xs text-muted-foreground">
          Replies use this room&apos;s AI agent. Select another room from the picker to connect a
          different agent.
        </p>
      </div>
      <div className="px-4 pb-5 pt-4 sm:px-5 sm:pb-6">
        <RoomConnectionsPanel roomName={roomName} channels={roomData.channels} />
      </div>
    </article>
  )
}
