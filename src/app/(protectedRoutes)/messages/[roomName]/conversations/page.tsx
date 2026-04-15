import React from 'react'
import { notFound, redirect } from 'next/navigation'
import { onAuthenticateUser } from '@/actions/auth'
import { prismaClient } from '@/lib/prismaClient'
import { verifyRoomOwnership } from '@/lib/messages/verifyRoomOwnership'
import { Platform } from '@prisma/client'
import { ConversationsClient } from './_components/ConversationsClient'

type Props = {
  params: Promise<{ roomName: string }>
  searchParams: Promise<{ platform?: string }>
}

const Page = async ({ params, searchParams }: Props) => {
  const [{ roomName: rawRoomName }, { platform }] = await Promise.all([params, searchParams])

  let roomName = rawRoomName.trim()
  try {
    roomName = decodeURIComponent(roomName).trim()
  } catch {
    /* keep trimmed raw */
  }
  if (!roomName) notFound()

  const auth = await onAuthenticateUser()
  if (!auth.user) {
    redirect('/sign-in')
  }

  const ownership = await verifyRoomOwnership(roomName)
  if (!ownership.ok) {
    if (ownership.reason === 'UNAUTHENTICATED') redirect('/sign-in')
    notFound()
  }

  const agent = ownership.agent

  const channels = await prismaClient.messageChannel.findMany({
    where: { roomName },
    include: {
      conversations: {
        orderBy: {
          updatedAt: 'desc',
        },
      },
    },
  })

  const validTabIds = ['TELEGRAM', 'DISCORD', 'MOBILE_SMTP'] as const
  type TabId = (typeof validTabIds)[number]
  const requested = (platform || '').toUpperCase()
  const activeTab: TabId = validTabIds.includes(requested as TabId)
    ? (requested as TabId)
    : 'TELEGRAM'

  return (
    <ConversationsClient
      roomName={roomName}
      agentName={agent?.name ?? roomName}
      channels={channels}
      activeTab={activeTab}
    />
  )
}

export default Page

