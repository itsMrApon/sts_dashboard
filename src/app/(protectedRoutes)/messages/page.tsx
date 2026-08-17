import React, { Suspense } from 'react'
import PageHeader from '@/components/ReusableComponent/PageHeader'
import { MessageCircle, Users, Webcam } from 'lucide-react'
import { onAuthenticateUser } from '@/actions/auth'
import { redirect } from 'next/navigation'
import { getMessageRoomsData } from '@/actions/publishProfiles'
import { MessagesRoomPicker } from './_components/MessagesRoomPicker'
import { MessagesHubCards } from './_components/MessagesHubCards'
import {
  parseRoomQueryParam,
  resolveSelectedMessagingRoom,
  toMessagingRoomOptions,
} from './_lib/messagingRooms'
import { startPerf, timeAsync } from '@/lib/dev/perf'
import { NewMessagesRoomButton } from './_components/NewMessagesRoomButton'
import { Button } from '@/components/ui/button'
import { PageViewport } from '@/components/ReusableComponent/PageViewport'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const page = async ({ searchParams }: Props) => {
  const timer = startPerf('route.messages')
  const params = await searchParams

  const auth = await timeAsync('route.messages.onAuthenticateUser', () => onAuthenticateUser())
  if (!auth.user) {
    redirect('/sign-in')
  }

  const allBusinesses = await timeAsync('route.messages.getMessageRoomsData', () =>
    getMessageRoomsData(auth.user.id),
  )

  const messagingRooms = allBusinesses.filter(
    (b) => b.agents.length > 0 || b._count.channels > 0,
  )

  const roomOptions = toMessagingRoomOptions(messagingRooms)
  const requestedRoomName = parseRoomQueryParam(params)
  const { activeRoomName, invalidRoom, needsDefaultRedirect, defaultRoomName } =
    resolveSelectedMessagingRoom(messagingRooms, requestedRoomName)

  if (needsDefaultRedirect && defaultRoomName) {
    redirect(`/messages?room=${encodeURIComponent(defaultRoomName)}`)
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
            <MessagesRoomPicker rooms={roomOptions} selectedRoomName={activeRoomName} />
          ) : undefined
        }
      >
        <Suspense fallback={<Button size="sm" className="h-10" disabled>New Room</Button>}>
          <NewMessagesRoomButton />
        </Suspense>
      </PageHeader>

      {messagingRooms.length === 0 ? (
        <div className="w-full rounded-2xl border border-border bg-card p-8 flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            {allBusinesses.length === 0 ? 'No rooms yet' : 'No rooms ready for Messages'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {allBusinesses.length === 0 ? (
              <>
                Use <strong>New room</strong> to connect an AI agent (and optional projects).
                A room appears here only when it has at least one agent or message channel — not
                projects alone.
              </>
            ) : (
              <>
                You have {allBusinesses.length} profile
                {allBusinesses.length === 1 ? '' : 's'} in your account, but none have an agent or
                message channel yet. Add them in <strong>Messages → Publish</strong> or use{' '}
                <strong>New room</strong>.
              </>
            )}
          </p>
        </div>
      ) : invalidRoom ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
          Room <span className="font-mono">{requestedRoomName}</span> was not found. Pick another
          room from the selector above.
        </div>
      ) : (
        <PageViewport className="flex min-h-0 w-full flex-col overflow-y-auto lg:overflow-hidden">
          <MessagesHubCards roomName={activeRoomName} />
        </PageViewport>
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
