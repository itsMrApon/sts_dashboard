import { auth } from '@clerk/nextjs/server'
import { notFound, redirect } from 'next/navigation'
import { prismaClient } from '@/lib/prismaClient'
import { getTokenForHost } from '@/actions/streamIo'
import { HostStreamCall } from './_components/HostStreamCall'

type Props = {
  params: Promise<{ callId: string }>
}

const page = async ({ params }: Props) => {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    redirect('/sign-in')
  }

  const { callId } = await params

  const user = await prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true, name: true, profileImage: true },
  })

  if (!user) notFound()

  const session = await prismaClient.streamCallSession.findUnique({
    where: { callId },
    select: { callId: true, roomName: true, hostUserId: true },
  })

  if (!session || session.hostUserId !== user.id) {
    notFound()
  }

  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY
  if (!apiKey) notFound()

  const token = await getTokenForHost(user.id, user.name, user.profileImage)

  return (
    <HostStreamCall
      apiKey={apiKey}
      callId={callId}
      callType="livestream"
      token={token}
      attendee={{ id: user.id, name: user.name, image: user.profileImage }}
      roomName={session.roomName}
    />
  )
}

export default page

