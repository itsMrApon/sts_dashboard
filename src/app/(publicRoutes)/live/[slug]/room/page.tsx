import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { prismaClient } from '@/lib/prismaClient'
import { getBuyerContactId } from '@/lib/offers/buyerSession'
import { attendeeEmailFor } from '@/lib/offers/offerAttendance'
import { loadPublicOffer } from '@/lib/offers/publicOffer'
import { avatarFor, mintLiveRoomToken, type LiveRoomUser } from '@/lib/stream/liveTokens'
import { LiveRoom } from './_components/LiveRoom'

type Props = { params: Promise<{ slug: string }> }

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const offer = await loadPublicOffer(slug)
  if (!offer) return { title: 'Live session', robots: { index: false } }
  return { title: `Live: ${offer.title} · ${offer.business.name}`, robots: { index: false } }
}

async function viewerUserId(): Promise<string | null> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return null
  const user = await prismaClient.user.findUnique({ where: { clerkId }, select: { id: true } })
  return user?.id ?? null
}

/**
 * The live session room (Live link). The presenter gets the studio (go live, drop the offer,
 * OBS, end); a visitor needs a seat saved in the waiting room and a session that is live.
 */
export default async function LiveRoomPage({ params }: Props) {
  const { slug } = await params
  const offer = await loadPublicOffer(slug)
  if (!offer?.live || !offer.modes.LIVE_HOST) notFound()

  const waitingRoom = `/live/${offer.slug}`
  if (offer.webinarStatus === 'ENDED' || offer.webinarStatus === 'CANCELLED') redirect(waitingRoom)

  const isHost = (await viewerUserId()) === offer.creatorUserId
  let user: LiveRoomUser
  let attendeeId: string | null = null

  if (isHost) {
    const presenter = await prismaClient.user.findUnique({
      where: { id: offer.creatorUserId },
      select: { name: true, profileImage: true },
    })
    const name = presenter?.name || offer.business.name
    user = { id: offer.creatorUserId, name, image: presenter?.profileImage || avatarFor(name) }
  } else {
    // Visitors come through the waiting room: it saves their seat and opens the doors when live.
    if (offer.webinarStatus !== 'LIVE') redirect(waitingRoom)
    const contactId = await getBuyerContactId(offer.creatorUserId)
    const contact = contactId
      ? await prismaClient.contact.findFirst({
          where: { id: contactId, userId: offer.creatorUserId },
          select: { email: true, phone: true },
        })
      : null
    const seat = contact
      ? await prismaClient.attendance.findFirst({
          where: { webinarId: offer.id, user: { email: attendeeEmailFor(contact) } },
          select: { user: { select: { id: true, name: true } } },
        })
      : null
    if (!seat) redirect(waitingRoom)
    attendeeId = seat.user.id
    user = { id: seat.user.id, name: seat.user.name || 'Guest', image: avatarFor(seat.user.name || 'Guest') }
  }

  const token = await mintLiveRoomToken(user)
  const hasSharePage = offer.modes.AI_ASSISTANT || offer.modes.INSTANT_CHECKOUT

  return (
    <LiveRoom
      role={isHost ? 'host' : 'viewer'}
      apiKey={process.env.NEXT_PUBLIC_STREAM_API_KEY ?? ''}
      token={token}
      user={user}
      hostUserId={offer.creatorUserId}
      attendeeId={attendeeId}
      session={{
        id: offer.id,
        slug: offer.slug,
        title: offer.title,
        description: offer.description,
        businessName: offer.business.name,
        isLive: offer.webinarStatus === 'LIVE',
        acceptingPayments: offer.acceptingPayments,
        sharePageHref: hasSharePage ? `/o/${offer.slug}` : null,
      }}
    />
  )
}
