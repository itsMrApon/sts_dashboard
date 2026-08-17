import type { RoomCardData } from '../_components/RoomCard'

/** Resolve LiveKit / message channel room name for a messaging hub row. */
export function resolveMessagingRoomName(room: RoomCardData): string | null {
  const primaryAgent = room.agents.find((a) => a.isPrimary) || room.agents[0]
  return primaryAgent?.agent.roomName ?? room.channels[0]?.roomName ?? null
}

export type MessagingRoomOption = {
  publishProfileId: string
  roomName: string
  label: string
  agentCount: number
  channelCount: number
}

export function toMessagingRoomOptions(rooms: RoomCardData[]): MessagingRoomOption[] {
  return rooms
    .map((room) => {
      const roomName = resolveMessagingRoomName(room)
      if (!roomName) return null
      return {
        publishProfileId: room.id,
        roomName,
        label: room.name,
        agentCount: room.agents.length,
        channelCount: room._count.channels,
      }
    })
    .filter((row): row is MessagingRoomOption => Boolean(row))
}

/** Decode `?room=` from Messages search params. */
export function parseRoomQueryParam(
  params: Record<string, string | string[] | undefined>,
): string | null {
  const roomParam = typeof params.room === 'string' ? params.room.trim() : ''
  if (!roomParam) return null
  try {
    return decodeURIComponent(roomParam)
  } catch {
    return roomParam
  }
}

export type ResolvedMessagingRoom = {
  activeRoom: RoomCardData | null
  activeRoomName: string | null
  invalidRoom: boolean
  needsDefaultRedirect: boolean
  defaultRoomName: string | null
}

/** Prefer `?room=`, otherwise the first available room. */
export function resolveSelectedMessagingRoom(
  rooms: RoomCardData[],
  requestedName: string | null,
): ResolvedMessagingRoom {
  const options = toMessagingRoomOptions(rooms)
  const defaultRoomName = options[0]?.roomName ?? null
  const selectedName = requestedName ?? defaultRoomName
  const activeRoom = selectedName
    ? rooms.find((r) => resolveMessagingRoomName(r) === selectedName) ?? null
    : null
  const activeRoomName = activeRoom ? resolveMessagingRoomName(activeRoom) : null
  return {
    activeRoom,
    activeRoomName,
    invalidRoom: Boolean(requestedName && !activeRoom),
    needsDefaultRedirect: Boolean(!requestedName && defaultRoomName),
    defaultRoomName,
  }
}

export function withRoomQuery(path: string, roomName: string | null): string {
  if (!roomName) return path
  return `${path}?room=${encodeURIComponent(roomName)}`
}
