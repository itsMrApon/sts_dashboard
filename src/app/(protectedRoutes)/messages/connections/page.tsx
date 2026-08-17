import React from 'react'
import { Suspense } from 'react'
import PageHeader from '@/components/ReusableComponent/PageHeader'
import { MessageCircle, Users, Webcam } from 'lucide-react'
import { onAuthenticateUser } from '@/actions/auth'
import { redirect } from 'next/navigation'
import { getMessageRoomsData } from '@/actions/publishProfiles'
import { MessagesRoomPicker } from '../_components/MessagesRoomPicker'
import { MessagesSubnav } from '../_components/MessagesSubnav'
import { ConnectionsRoomSection } from '../_components/ConnectionsRoomSection'
import {
  parseRoomQueryParam,
  resolveSelectedMessagingRoom,
  toMessagingRoomOptions,
} from '../_lib/messagingRooms'
import { startPerf, timeAsync } from '@/lib/dev/perf'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const page = async ({ searchParams }: Props) => {
  const timer = startPerf('route.messages.connections')
  const params = await searchParams

  const auth = await timeAsync('route.messages.connections.onAuthenticateUser', () =>
    onAuthenticateUser(),
  )
  if (!auth.user) {
    redirect('/sign-in')
  }

  const allBusinesses = await timeAsync('route.messages.connections.getMessageRoomsData', () =>
    getMessageRoomsData(auth.user.id),
  )

  const messagingRooms = allBusinesses.filter(
    (b) => b.agents.length > 0 || b._count.channels > 0,
  )

  const userId = auth.user.id
  const roomOptions = toMessagingRoomOptions(messagingRooms)
  const requestedRoomName = parseRoomQueryParam(params)
  const { activeRoom, activeRoomName, invalidRoom, needsDefaultRedirect, defaultRoomName } =
    resolveSelectedMessagingRoom(messagingRooms, requestedRoomName)

  if (needsDefaultRedirect && defaultRoomName) {
    redirect(`/messages/connections?room=${encodeURIComponent(defaultRoomName)}`)
  }

  const rendered = (
    <div className="w-full flex flex-col gap-8">
      <PageHeader
        leftIcon={<Webcam className="w-3 h-3" />}
        mainIcon={<MessageCircle className="w-12 h-12" />}
        rightIcon={<Users className="w-4 h-4" />}
        heading="Messages"
        searchControl={
          roomOptions.length > 0 ? (
            <MessagesRoomPicker
              rooms={roomOptions}
              selectedRoomName={activeRoomName}
              basePath="/messages/connections"
            />
          ) : undefined
        }
      >
        <MessagesSubnav active="connections" selectedRoomName={activeRoomName} />
      </PageHeader>

      {messagingRooms.length === 0 ? (
        <div className="w-full rounded-2xl border border-border bg-card p-8 flex flex-col gap-3">
          <h2 className="text-lg font-semibold">No rooms to connect</h2>
          <p className="text-sm text-muted-foreground">
            Create a room first, then attach Telegram, Discord, or Slack. Replies use that room&apos;s
            AI agent.
          </p>
        </div>
      ) : invalidRoom ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
          Room <span className="font-mono">{requestedRoomName}</span> was not found. Pick another
          room from the selector above.
        </div>
      ) : activeRoom && activeRoomName ? (
        <Suspense
          fallback={<div className="h-64 w-full rounded-2xl border border-border bg-muted/40 animate-pulse" />}
        >
          <ConnectionsRoomSection room={activeRoom} userId={userId} />
        </Suspense>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
          Select a room to attach Telegram, Discord, or Slack. Replies use that room&apos;s AI
          agent.
        </div>
      )}
    </div>
  )

  timer.end({
    businessCount: allBusinesses.length,
    roomCount: messagingRooms.length,
    selectedRoom: activeRoomName,
  })
  return rendered
}

export default page
