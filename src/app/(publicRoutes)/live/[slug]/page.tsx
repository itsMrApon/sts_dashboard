import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { prismaClient } from '@/lib/prismaClient'
import { loadPublicOffer, toPublicView } from '@/lib/offers/publicOffer'
import { getBuyerContactId } from '@/lib/offers/buyerSession'
import { attendeeEmailFor } from '@/lib/offers/offerAttendance'
import { normalizeSource } from '@/lib/offers/leadInput'
import type { BuyerContactView } from '@/lib/offers/publicOfferTypes'
import { LiveWaitingRoom } from './_components/LiveWaitingRoom'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ src?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const offer = await loadPublicOffer(slug)
  if (!offer?.live || !offer.modes.LIVE_HOST) return { title: 'Live session not available' }
  const title = `Live: ${offer.title} · ${offer.business.name}`
  const description = offer.description.slice(0, 200) || `Save your seat for ${offer.business.name}'s live session`
  return { title, description, openGraph: { title, description, type: 'website' }, twitter: { card: 'summary', title, description } }
}

async function viewerIsCreator(creatorUserId: string): Promise<boolean> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return false
  const viewer = await prismaClient.user.findUnique({ where: { clerkId }, select: { id: true } })
  return viewer?.id === creatorUserId
}

/**
 * The Live link: a waiting room that counts down to the creator's start time. Visitors save a
 * seat with their email or WhatsApp; when the creator goes live the doors open into the live room.
 */
export default async function LiveLinkPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const offer = await loadPublicOffer(slug)
  if (!offer) notFound()

  if (!offer.live || !offer.modes.LIVE_HOST) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-center">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">This live session isn&apos;t available</h1>
          <p className="text-sm text-muted-foreground">Please check back later or contact {offer.business.name}.</p>
        </div>
      </main>
    )
  }

  // The creator opening their own Live link goes straight to the host room (go live from there).
  if (await viewerIsCreator(offer.creatorUserId)) redirect(`/live/${offer.slug}/room`)

  const contactId = await getBuyerContactId(offer.creatorUserId)
  const contactRow = contactId
    ? await prismaClient.contact.findFirst({
        where: { id: contactId, userId: offer.creatorUserId },
        select: { name: true, email: true, phone: true },
      })
    : null
  const contact: BuyerContactView | null = contactRow
  const registered = contactRow
    ? !!(await prismaClient.attendance.findFirst({
        where: { webinarId: offer.id, user: { email: attendeeEmailFor(contactRow) } },
        select: { id: true },
      }))
    : false

  return (
    <LiveWaitingRoom
      offer={toPublicView(offer)}
      contact={contact}
      registered={registered}
      source={normalizeSource(query.src) ?? 'live'}
      hasSharePage={offer.modes.AI_ASSISTANT || offer.modes.INSTANT_CHECKOUT}
    />
  )
}
