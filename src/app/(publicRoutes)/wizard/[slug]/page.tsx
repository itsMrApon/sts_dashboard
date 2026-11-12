import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { prismaClient } from '@/lib/prismaClient'
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

export default async function WizardPublicPage({ params }: Props) {
  const { slug } = await params
  const wizard = await getPublicWizard(slug, await viewerUserId())
  if (!wizard || wizard.steps.length === 0) notFound()
  return <WizardTour wizard={wizard} />
}
