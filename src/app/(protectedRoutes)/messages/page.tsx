import React from 'react'
import { Suspense } from 'react'
import PageHeader from '@/components/ReusableComponent/PageHeader'
import { HomeIcon, MessageCircle, Sparkles } from 'lucide-react'
import { onAuthenticateUser } from '@/actions/auth'
import { redirect } from 'next/navigation'
import { getMessageRoomsData } from '@/actions/business'
import RoomCard from './_components/RoomCard'
import { startPerf, timeAsync } from '@/lib/dev/perf'
import { CreateBusinessModalLoader } from './_components/CreateBusinessModalLoader'
import { Button } from '@/components/ui/button'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const page = async ({ searchParams }: Props) => {
  const timer = startPerf('route.messages')
  await searchParams

  const auth = await timeAsync('route.messages.onAuthenticateUser', () => onAuthenticateUser())
  if (!auth.user) {
    redirect('/sign-in')
  }

  const allBusinesses = await timeAsync('route.messages.getMessageRoomsData', () =>
    getMessageRoomsData(auth.user.id),
  )

  /**
   * Only hubs that can actually use Messages: an AI agent and/or message channels.
   * Linked projects alone stay on Tenants → Business profile — avoids “ghost” cards after
   * removing agents/channels but leaving products.
   */
  const messagingRooms = allBusinesses.filter(
    (b) => b.agents.length > 0 || b._count.channels > 0,
  )

  const userId = auth.user.id

  const businessProfiles = allBusinesses.map((b) => ({
    businessId: b.id,
    name: b.name,
    pitchTenantId: b.profileTenantId,
  }))

  const rendered = (
    <div className="w-full flex flex-col gap-8">
      <PageHeader
        leftIcon={<HomeIcon className="w-3 h-3" />}
        mainIcon={<MessageCircle className="w-12 h-12" />}
        rightIcon={<Sparkles className="w-4 h-4" />}
        heading="Messages"
        placeholder="Search rooms…"
      >
        <Suspense fallback={<Button size="sm" disabled>New Room</Button>}>
          <CreateBusinessModalLoader userId={userId} businessProfiles={businessProfiles} />
        </Suspense>
      </PageHeader>

      {messagingRooms.length === 0 ? (
        <div className="w-full rounded-2xl border border-border bg-card p-8 flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            {allBusinesses.length === 0
              ? 'No rooms yet'
              : 'No rooms ready for Messages'}
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
                message channel yet. Add them in <strong>Tenants → Business profile</strong> or use{' '}
                <strong>New room</strong>.
              </>
            )}
          </p>
        </div>
      ) : (
        <ul
          role="list"
          className="m-0 flex w-full min-w-0 list-none flex-col gap-4 p-0"
          aria-label="Messaging rooms"
        >
          {messagingRooms.map((r) => (
            <li key={r.id} className="w-full min-w-0 list-none">
              <RoomCard room={r} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
  timer.end({ businessCount: allBusinesses.length, roomCount: messagingRooms.length })
  return rendered
}

export default page
