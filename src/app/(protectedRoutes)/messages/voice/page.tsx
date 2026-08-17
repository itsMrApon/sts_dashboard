import React, { Suspense } from 'react'
import PageHeader from '@/components/ReusableComponent/PageHeader'
import { MessageCircle, Users, Webcam } from 'lucide-react'
import { onAuthenticateUser } from '@/actions/auth'
import { redirect } from 'next/navigation'
import { getMessageRoomsData } from '@/actions/publishProfiles'
import { MessagingRoomSection } from '../_components/MessagingRoomSection'
import { MessagingRoomSectionFallback } from '../_components/MessagingRoomSectionFallback'
import { MessagesRoomPicker } from '../_components/MessagesRoomPicker'
import { MessagesSubnav } from '../_components/MessagesSubnav'
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
  const timer = startPerf('route.messages.voice')
  const params = await searchParams

  const auth = await timeAsync('route.messages.voice.onAuthenticateUser', () =>
    onAuthenticateUser(),
  )
  if (!auth.user) {
    redirect('/sign-in')
  }

  const allBusinesses = await timeAsync('route.messages.voice.getMessageRoomsData', () =>
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
    redirect(`/messages/voice?room=${encodeURIComponent(defaultRoomName)}`)
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
              basePath="/messages/voice"
            />
          ) : undefined
        }
      >
        <MessagesSubnav active="rooms" selectedRoomName={activeRoomName} />
      </PageHeader>

      {messagingRooms.length === 0 ? (
        <div className="w-full rounded-2xl border border-border bg-card p-8 flex flex-col gap-3">
          <h2 className="text-lg font-semibold">No rooms yet</h2>
          <p className="text-sm text-muted-foreground">
            Create a room from the Messages hub, then come back to configure web chat and embed.
          </p>
        </div>
      ) : invalidRoom ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
          Room <span className="font-mono">{requestedRoomName}</span> was not found. Pick another
          room from the selector above.
        </div>
      ) : activeRoom && activeRoomName ? (
        <Suspense fallback={<MessagingRoomSectionFallback room={activeRoom} />}>
          <MessagingRoomSection room={activeRoom} userId={userId} />
        </Suspense>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
          Select a room from the picker above to configure workspace, web chat, and embed.
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
