import 'server-only'
import { auth } from '@clerk/nextjs/server'
import { getBusinessByRoomName, type CreatorBusiness } from '@/lib/business/creatorBusiness'
import { prismaClient } from '@/lib/prismaClient'
import { getBusinessServices, type BusinessServices } from '@/lib/services/serviceConfig'

/**
 * Every public service of a business lives on one page, /business/{room}, keyed by the business
 * AI room name. Chat, Talk and the form open as panels there (#chat, #talk, #form) and the tour
 * starts from #tour. The old /chat, /speak, /form and /wizard pages redirect to these.
 */
export type PublicServiceKind = 'chat' | 'speak' | 'form' | 'business'

/** The panel each service opens on the business page. */
export const BUSINESS_PANEL_HASH = { chat: 'chat', speak: 'talk', form: 'form', wizard: 'tour' } as const

export type PublicServiceLinks = Partial<Record<PublicServiceKind | 'wizard', string>>

export type PublicBusiness = {
  business: CreatorBusiness
  /** The business's published tour (not a product's), played on the business page. */
  wizardSlug: string | null
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

export function publicServicePath(kind: PublicServiceKind | 'wizard', roomName: string): string {
  const page = `/business/${encodeURIComponent(roomName)}`
  return kind === 'business' ? page : `${page}#${BUSINESS_PANEL_HASH[kind]}`
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
  if (wizard?.slug) links.wizard = publicServicePath('wizard', business.roomName)

  return {
    business,
    wizardSlug: wizard?.slug ?? null,
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
