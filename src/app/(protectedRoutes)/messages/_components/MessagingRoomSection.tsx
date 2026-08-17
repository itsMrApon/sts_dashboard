import { timeAsync } from '@/lib/dev/perf'
import { getRoomPageDataCached } from '../_lib/getRoomPageData'
import RoomCard, { type RoomCardData } from './RoomCard'
import { RoomConfigurationPanel } from './RoomConfigurationPanel'

type Props = {
  room: RoomCardData
  userId: string
  defaultExpanded?: boolean
}

export async function MessagingRoomSection({ room, userId, defaultExpanded = true }: Props) {
  const primaryAgent = room.agents.find((a) => a.isPrimary) || room.agents[0]
  const roomName =
    primaryAgent?.agent.roomName ?? room.channels[0]?.roomName ?? null

  if (!roomName) {
    return <RoomCard room={room} />
  }

  const roomData = await timeAsync(`messages.roomConfig.${roomName}`, () =>
    getRoomPageDataCached(userId, roomName, primaryAgent?.agent.id ?? null),
  )

  return (
    <article
      id={`room-${encodeURIComponent(roomName)}`}
      className="scroll-mt-24 w-full min-w-0 rounded-2xl border border-border bg-card shadow-sm"
    >
      <RoomCard room={room} roomName={roomName} embedded />
      {defaultExpanded && (
        <div className="border-t border-border/70 px-4 pb-5 pt-4 sm:px-5 sm:pb-6">
          <RoomConfigurationPanel
            roomName={roomName}
            agent={primaryAgent?.agent ?? null}
            roomData={roomData}
            userId={userId}
          />
        </div>
      )}
    </article>
  )
}
