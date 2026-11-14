import 'server-only'
import { getStreamClient } from '@/lib/stream/streamClient'

/** Long enough for a session plus OBS streaming (the host token doubles as the RTMP stream key). */
const LIVE_TOKEN_SECONDS = 6 * 60 * 60

export type LiveRoomUser = { id: string; name: string; image: string }

export function avatarFor(name: string): string {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || 'Guest')}`
}

/**
 * Stream (video + chat) token for the live room. Minted only on the server, for an identity the
 * room page has already verified (the signed-in presenter, or the visitor's own seat).
 */
export async function mintLiveRoomToken(user: LiveRoomUser): Promise<string> {
  await getStreamClient.upsertUsers([{ id: user.id, role: 'user', name: user.name, image: user.image }])
  return getStreamClient.generateUserToken({ user_id: user.id, validity_in_seconds: LIVE_TOKEN_SECONDS })
}
