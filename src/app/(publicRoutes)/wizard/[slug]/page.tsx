import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'
import { prismaClient } from '@/lib/prismaClient'
import { publicServicePath } from '@/lib/public/publicService'
import { getPublicWizard } from '@/lib/wizard/wizardRepo'
import { WizardTour } from './_components/WizardTour'

type Props = { params: Promise<{ slug: string }> }

async function viewerUserId(): Promise<string | null> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return null
  const user = await prismaClient.user.findUnique({ where: { clerkId }, select: { id: true } })
  return user?.id ?? null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const wizard = await getPublicWizard(slug, null)
  if (!wizard) return { title: 'Wizard', robots: { index: false } }
  return {
    title: `${wizard.businessName} — guided tour`,
    description: wizard.steps[0]?.body || `A guided voice tour of ${wizard.businessName}.`,
  }
}

/**
 * A business's own tour now plays on its business page as the visitor scrolls, so its old link
 * redirects there. A product's tour (tied to a project) still plays here.
 */
export default async function WizardPublicPage({ params }: Props) {
  const { slug } = await params
  // Drafts stay here so the owner can still preview a tour before publishing it.
  const owner = await prismaClient.voiceWizard.findUnique({
    where: { slug },
    select: { userId: true, webinarId: true, isPublished: true },
  })
  if (owner && !owner.webinarId && owner.isPublished) {
    const business = await getCreatorBusiness(owner.userId)
    if (business) redirect(publicServicePath('wizard', business.roomName))
  }
  const wizard = await getPublicWizard(slug, await viewerUserId())
  if (!wizard || wizard.steps.length === 0) notFound()
  return <WizardTour wizard={wizard} />
}
