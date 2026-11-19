import 'server-only'
import { prismaClient } from '@/lib/prismaClient'
import { buildOfferShareLinks, enabledModes, primaryOfferLink } from '@/lib/offers/offerLinks'
import type { SiteLive } from '@/lib/business/siteContent'
import { isWebinarOver } from '@/lib/offers/offerSummary'

export type BusinessOffer = { title: string; description: string | null; href: string; live: boolean }

/**
 * Projects and products listed on the business site (hosted page and the Services live view).
 * Ended webinars and offers with no way to order on are left out; each links to its primary link.
 */
export async function loadBusinessOffers(publishProfileId: string): Promise<BusinessOffer[]> {
  const products = await prismaClient.publishProduct.findMany({
    where: { publishProfileId, webinar: { deletedAt: null, slug: { not: null } } },
    orderBy: [{ isPrimary: 'desc' }],
    select: {
      webinar: {
        select: {
          title: true,
          description: true,
          slug: true,
          kind: true,
          webinarStatus: true,
          orderModes: { select: { kind: true, enabled: true } },
        },
      },
    },
  })
  return products.flatMap(({ webinar }) => {
    if (webinar.kind === 'PROJECT' && isWebinarOver(webinar.webinarStatus)) return []
    const link = primaryOfferLink(webinar, enabledModes(webinar.orderModes), '')
    if (!link) return []
    return [{ title: webinar.title, description: webinar.description, href: link.url, live: link.variant === 'live' }]
  })
}

/** A product or project as the creator's own website gets it (Connect website SDK). */
export type BusinessOfferForSite = {
  title: string
  description: string | null
  kind: 'PRODUCT' | 'PROJECT'
  featured: boolean
  /** The one link to use when the site shows a single button (same choice as the hosted page). */
  primaryUrl: string
  /** Every way to order that is on: share (AI room or checkout), pay (straight to Stripe), live. */
  links: { share: string | null; pay: string | null; live: string | null }
}

/**
 * The products and projects on the business, with absolute links, for the SDK. Same rules as the
 * hosted page: ended webinars and offers with no way to order are left out. Products are added to
 * the business when they are created, so the creator never lists them twice.
 */
export async function loadBusinessOffersForSite(publishProfileId: string, baseUrl: string): Promise<BusinessOfferForSite[]> {
  const products = await prismaClient.publishProduct.findMany({
    where: { publishProfileId, webinar: { deletedAt: null, slug: { not: null } } },
    orderBy: [{ isPrimary: 'desc' }],
    select: {
      isPrimary: true,
      webinar: {
        select: {
          title: true,
          description: true,
          slug: true,
          kind: true,
          webinarStatus: true,
          orderModes: { select: { kind: true, enabled: true } },
        },
      },
    },
  })
  return products.flatMap(({ isPrimary, webinar }) => {
    if (webinar.kind === 'PROJECT' && isWebinarOver(webinar.webinarStatus)) return []
    const modes = enabledModes(webinar.orderModes)
    const primary = primaryOfferLink(webinar, modes, baseUrl)
    if (!primary) return []
    const links = buildOfferShareLinks(webinar.slug, modes, baseUrl)
    const urlOf = (variant: 'share' | 'pay' | 'live') => links.find((link) => link.variant === variant)?.url ?? null
    return [
      {
        title: webinar.title,
        description: webinar.description,
        kind: webinar.kind,
        featured: isPrimary,
        primaryUrl: primary.url,
        links: { share: urlOf('share'), pay: urlOf('pay'), live: urlOf('live') },
      },
    ]
  })
}

/** An upcoming or running live session (a webinar from Projects) for the Live service. */
export type LiveSession = {
  slug: string
  title: string
  description: string | null
  thumbnail: string | null
  /** ISO times. */
  startsAt: string
  endsAt: string | null
  status: 'scheduled' | 'waiting' | 'live'
  /** /live/<slug>: waiting room with a countdown, then the session. Null while "Live with you" is off. */
  joinUrl: string | null
  /** /o/<slug>: sign up or buy first. Null when that way to order is off. */
  shareUrl: string | null
}

/** A scheduled session this far past its start (and never opened) counts as missed, not upcoming. */
const MISSED_AFTER_MS = 3 * 60 * 60 * 1000

/**
 * Webinars on the business that are coming up or running now, soonest first. Ended, cancelled and
 * long-missed ones are left out. Sessions without a live link are kept (joinUrl null) so the
 * dashboard can say how to turn it on; the SDK only sends the joinable ones.
 */
export async function loadUpcomingLiveSessions(publishProfileId: string, baseUrl: string, now = new Date()): Promise<LiveSession[]> {
  const rows = await prismaClient.publishProduct.findMany({
    where: {
      publishProfileId,
      webinar: {
        deletedAt: null,
        slug: { not: null },
        kind: 'PROJECT',
        webinarStatus: { in: ['SCHEDULED', 'WAITING_ROOM', 'LIVE'] },
      },
    },
    select: {
      webinar: {
        select: {
          title: true,
          description: true,
          thumbnail: true,
          slug: true,
          startTime: true,
          endTime: true,
          webinarStatus: true,
          orderModes: { select: { kind: true, enabled: true } },
        },
      },
    },
  })
  const statusOf = { SCHEDULED: 'scheduled', WAITING_ROOM: 'waiting', LIVE: 'live' } as const
  return rows
    .map(({ webinar }) => webinar)
    .filter(
      (webinar) =>
        webinar.webinarStatus !== 'SCHEDULED' || webinar.startTime.getTime() > now.getTime() - MISSED_AFTER_MS,
    )
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    .slice(0, 20)
    .map((webinar) => {
      const links = buildOfferShareLinks(webinar.slug, enabledModes(webinar.orderModes), baseUrl)
      const urlOf = (variant: 'share' | 'live') => links.find((link) => link.variant === variant)?.url ?? null
      return {
        slug: webinar.slug as string,
        title: webinar.title,
        description: webinar.description,
        thumbnail: webinar.thumbnail,
        startsAt: webinar.startTime.toISOString(),
        endsAt: webinar.endTime?.toISOString() ?? null,
        status: statusOf[webinar.webinarStatus as keyof typeof statusOf],
        joinUrl: urlOf('live'),
        shareUrl: urlOf('share'),
      }
    })
}

/** The sessions the website shows: Live on, not hidden, joinable, at most maxSessions. */
export function liveSessionsForSite(sessions: LiveSession[], settings: SiteLive): LiveSession[] {
  if (!settings.enabled) return []
  return sessions
    .filter((session) => session.joinUrl && !settings.hiddenSlugs.includes(session.slug))
    .slice(0, settings.maxSessions)
}
