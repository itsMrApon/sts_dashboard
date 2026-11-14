import type { Channel as ChatChannel } from 'stream-chat'

/** What the live room shows about the session (client-safe). */
export type LiveSessionView = {
  id: string
  slug: string
  title: string
  description: string
  businessName: string
  isLive: boolean
  acceptingPayments: boolean
  sharePageHref: string | null
}

/** Custom chat events the host uses to steer every viewer at once. */
export type LiveRoomEvent = 'open_cta_dialog' | 'start_live' | 'end_live'

export function sendRoomEvent(channel: ChatChannel, type: LiveRoomEvent) {
  // Custom event types are allowed by Stream but not in its event union type.
  return channel.sendEvent({ type } as unknown as Parameters<ChatChannel['sendEvent']>[0])
}
