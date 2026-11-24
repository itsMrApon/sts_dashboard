import { prismaClient } from '@/lib/prismaClient'
import {
  isSyntheticBusinessEmail,
  syntheticBusinessEmail,
  type SerperMapPlace,
} from '@/lib/leads/serperMaps'

export async function ingestBusinessLeadForUser(options: {
  userId: string
  place: SerperMapPlace
  defaultAgentId?: string | null
}): Promise<{ leadId: string; created: boolean }> {
  const { userId, place } = options
  const email = syntheticBusinessEmail(place.placeId)
  const name = place.title
  const company = place.title
  // Category and rating have their own fields; notes stay for what the person writes.
  const maps = {
    mapsCategory: place.category ? place.category.slice(0, 120) : null,
    mapsRating: place.rating ?? null,
    mapsReviewCount: place.ratingCount ?? null,
  }

  const existingByPlace = place.placeId
    ? await prismaClient.callIntelLead.findFirst({
        where: { userId, placeId: place.placeId, source: 'BUSINESS' },
        select: { id: true },
      })
    : null

  if (existingByPlace) {
    await prismaClient.callIntelLead.update({
      where: { id: existingByPlace.id },
      data: {
        name,
        company,
        phone: place.phone,
        website: place.website,
        address: place.address,
        placeId: place.placeId,
        source: 'BUSINESS',
        ...maps,
        selectedAgentId: options.defaultAgentId || undefined,
      },
    })
    return { leadId: existingByPlace.id, created: false }
  }

  const existingByEmail = await prismaClient.callIntelLead.findUnique({
    where: { userId_email: { userId, email } },
    select: { id: true },
  })

  if (existingByEmail) {
    await prismaClient.callIntelLead.update({
      where: { id: existingByEmail.id },
      data: {
        name,
        company,
        phone: place.phone,
        website: place.website,
        address: place.address,
        placeId: place.placeId,
        source: 'BUSINESS',
        ...maps,
        selectedAgentId: options.defaultAgentId || undefined,
      },
    })
    return { leadId: existingByEmail.id, created: false }
  }

  const created = await prismaClient.callIntelLead.create({
    data: {
      userId,
      email,
      name,
      company,
      phone: place.phone,
      website: place.website,
      address: place.address,
      placeId: place.placeId,
      source: 'BUSINESS',
      ...maps,
      selectedAgentId: options.defaultAgentId || null,
    },
    select: { id: true },
  })

  return { leadId: created.id, created: true }
}

export function isBusinessLeadEmail(email: string | null | undefined): boolean {
  return isSyntheticBusinessEmail(email)
}
