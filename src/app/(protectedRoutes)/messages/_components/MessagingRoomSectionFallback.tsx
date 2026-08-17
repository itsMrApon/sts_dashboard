import RoomCard, { type RoomCardData } from './RoomCard'
import {
  resolveMessagingRoomName,
} from '../_lib/messagingRooms'

type Props = {
  room: RoomCardData
}

/** Immediate shell while room config queries stream in via Suspense. */
export function MessagingRoomSectionFallback({ room }: Props) {
  const roomName = resolveMessagingRoomName(room)

  return (
    <article
      id={roomName ? `room-${encodeURIComponent(roomName)}` : undefined}
      className="scroll-mt-24 w-full min-w-0 rounded-2xl border border-border bg-card shadow-sm"
    >
      <RoomCard room={room} roomName={roomName} embedded />
      <div className="border-t border-border/70 px-4 pb-5 pt-4 sm:px-5 sm:pb-6">
        <div className="h-40 w-full rounded-xl bg-muted animate-pulse" />
      </div>
    </article>
  )
}
