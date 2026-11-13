import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { prismaClient } from '@/lib/prismaClient'
import { loadPublicOffer, toPublicView } from '@/lib/offers/publicOffer'
import { getBuyerContactId } from '@/lib/offers/buyerSession'
import { refreshOrderFromStripe } from '@/lib/offers/offerOrders'
import { normalizeSource } from '@/lib/offers/leadInput'
import { loadOfferChatHistory } from '@/lib/offers/offerAi'
import { getPublicWizard } from '@/lib/wizard/wizardRepo'
import type { BuyerContactView } from '@/lib/offers/publicOfferTypes'
import { OfferLanding } from './_components/OfferLanding'

/** The signed-in sts-ai user (if any), so a creator can preview their own draft tour. */
async function viewerUserId(): Promise<string | null> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return null
  const user = await prismaClient.user.findUnique({ where: { clerkId }, select: { id: true } })
  return user?.id ?? null
}

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ src?: string; order?: string; canceled?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const offer = await loadPublicOffer(slug)
  if (!offer?.live) return { title: 'Offer not available' }
  const title = `${offer.title} · ${offer.business.name}`
  const description = offer.description.slice(0, 200) || `${offer.business.name} on sts-ai`
  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

/** The one share link for an offer: lead first, then only the ways to order the creator turned on. */
export default async function OfferSharePage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const offer = await loadPublicOffer(slug)
  if (!offer) notFound()

  if (!offer.live) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-center">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">This offer isn&apos;t available right now</h1>
          <p className="text-sm text-muted-foreground">Please check back later or contact {offer.business.name}.</p>
        </div>
      </main>
    )
  }

  const contactId = await getBuyerContactId(offer.creatorUserId)
  const contactRow = contactId
    ? await prismaClient.contact.findFirst({
        where: { id: contactId, userId: offer.creatorUserId },
        select: { name: true, email: true, phone: true },
      })
    : null
  const contact: BuyerContactView | null = contactRow

  const orderId = query.order && /^[0-9a-f-]{36}$/i.test(query.order) ? query.order : null
  const wantsChat = offer.modes.AI_ASSISTANT && offer.aiServices.includes('CHAT')
  const wantsTour = offer.modes.AI_ASSISTANT && offer.aiServices.includes('WIZARD') && !!offer.wizardSlug
  const viewerId = wantsTour ? await viewerUserId() : null
  const [orderStatus, chatHistory, wizard] = await Promise.all([
    orderId ? refreshOrderFromStripe(orderId, offer.id) : null,
    contactRow && contactId && wantsChat ? loadOfferChatHistory(offer, contactId) : [],
    wantsTour && offer.wizardSlug ? getPublicWizard(offer.wizardSlug, viewerId) : null,
  ])

  return (
    <OfferLanding
      offer={toPublicView(offer)}
      contact={contact}
      source={normalizeSource(query.src)}
      orderStatus={orderStatus}
      canceled={query.canceled === '1'}
      chatHistory={chatHistory}
      wizard={wizard && wizard.steps.length ? wizard : null}
    />
  )
}
