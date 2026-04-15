import React from 'react'
import PageHeader from '@/components/ReusableComponent/PageHeader'
import { HomeIcon, MessageCircle, Sparkles } from 'lucide-react'
import { onAuthenticateUser } from '@/actions/auth'
import { redirect } from 'next/navigation'
import { getBusinesses } from '@/actions/business'
import { prismaClient } from '@/lib/prismaClient'
import RoomCard from './_components/RoomCard'
import { CreateBusinessModal } from './_components/CreateBusinessModal'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const page = async ({ searchParams }: Props) => {
  await searchParams

  const auth = await onAuthenticateUser()
  if (!auth.user) {
    redirect('/sign-in')
  }

  const allBusinesses = await getBusinesses()

  /**
   * Only hubs that can actually use Messages: an AI agent and/or message channels.
   * Linked projects alone stay on Tenants → Business profile — avoids “ghost” cards after
   * removing agents/channels but leaving products.
   */
  const messagingRooms = allBusinesses.filter(
    (b) => b.agents.length > 0 || b._count.channels > 0,
  )

  const user = await prismaClient.user.findUnique({
    where: { clerkId: auth.user.clerkId },
    select: { id: true },
  })

  const agents = user
    ? await prismaClient.liveKitAgent.findMany({
        where: {
          OR: [
            { businessAgents: { none: {} } },
            {
              businessAgents: {
                some: { business: { userId: user.id } },
              },
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, roomName: true },
      })
    : []

  const products = user
    ? await prismaClient.webinar.findMany({
        where: { presenterId: user.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, kind: true },
      })
    : []

  const businessProfileRows = user
    ? await prismaClient.business.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          name: true,
          tenants: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: { id: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    : []

  const businessProfiles = businessProfileRows.map((b) => ({
    businessId: b.id,
    name: b.name,
    pitchTenantId: b.tenants[0]?.id ?? null,
  }))

  return (
    <div className="w-full flex flex-col gap-8">
      <PageHeader
        leftIcon={<HomeIcon className="w-3 h-3" />}
        mainIcon={<MessageCircle className="w-12 h-12" />}
        rightIcon={<Sparkles className="w-4 h-4" />}
        heading="Messages"
        placeholder="Search rooms…"
      >
        <CreateBusinessModal agents={agents} products={products} businessProfiles={businessProfiles} />
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
}

export default page
