import 'server-only'
import { auth } from '@clerk/nextjs/server'
import { getBusinessByRoomName, type CreatorBusiness } from '@/lib/business/creatorBusiness'
import { prismaClient } from '@/lib/prismaClient'
import { getBusinessServices, type BusinessServices } from '@/lib/services/serviceConfig'

/**
 * One business's public service pages (/chat, /speak, /form, /business) are all keyed by the
 * business AI room name, e.g. /speak/biz-acme-4adxz2.
 */
export type PublicServiceKind = 'chat' | 'speak' | 'form' | 'business'

export type PublicServiceLinks = Partial<Record<PublicServiceKind | 'wizard', string>>

export type PublicBusiness = {
  business: CreatorBusiness
  agent: { name: string; firstMessage: string | null; language: string }
  services: BusinessServices
  /** Business site published (Business service is "on"). */
  sitePublished: boolean
  /** The signed-in viewer owns this business: they may preview services that are off. */
  isOwner: boolean
  /** Public pages of this business that are switched on (for cross-links). */
  links: PublicServiceLinks
}

async function viewerUserId(): Promise<string | null> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return null
  const user = await prismaClient.user.findUnique({ where: { clerkId }, select: { id: true } })
  return user?.id ?? null
}

export function publicServicePath(kind: PublicServiceKind, roomName: string): string {
  return `/${kind}/${encodeURIComponent(roomName)}`
}

/** Loads a business by its AI room name with everything a public service page needs. */
export async function loadPublicBusiness(roomName: string): Promise<PublicBusiness | null> {
  const business = await getBusinessByRoomName(roomName)
  if (!business) return null

  const [agent, services, workspace, wizard, viewerId] = await Promise.all([
    prismaClient.liveKitAgent.findUnique({
      where: { id: business.agentId },
      select: { name: true, firstMessage: true, language: true },
    }),
    getBusinessServices(business.workspaceId),
    prismaClient.workspace.findUnique({
      where: { id: business.workspaceId },
      select: { contextStatus: true },
    }),
    prismaClient.voiceWizard.findFirst({
      where: { userId: business.userId, webinarId: null, isPublished: true },
      orderBy: { publishedAt: 'desc' },
      select: { slug: true },
    }),
    viewerUserId(),
  ])

  const sitePublished = workspace?.contextStatus === 'PUBLISHED'
  const links: PublicServiceLinks = {}
  if (services.chat.enabled) links.chat = publicServicePath('chat', business.roomName)
  if (services.speak.enabled) links.speak = publicServicePath('speak', business.roomName)
  if (services.form.enabled) links.form = publicServicePath('form', business.roomName)
  if (sitePublished) links.business = publicServicePath('business', business.roomName)
  if (wizard?.slug) links.wizard = `/wizard/${encodeURIComponent(wizard.slug)}`

  return {
    business,
    agent: {
      name: agent?.name ?? business.name,
      firstMessage: agent?.firstMessage ?? null,
      language: agent?.language || 'en',
    },
    services,
    sitePublished,
    isOwner: viewerId === business.userId,
    links,
  }
}

/** Whether a service page may render: on for everyone, or off but viewed by its owner (preview). */
export function serviceAccess(
  loaded: PublicBusiness,
  kind: PublicServiceKind,
): 'live' | 'owner-preview' | 'off' {
  const enabled = kind === 'business' ? loaded.sitePublished : loaded.services[kind].enabled
  if (enabled) return 'live'
  return loaded.isOwner ? 'owner-preview' : 'off'
}
