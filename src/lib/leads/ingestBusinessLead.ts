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
  const notesParts = [
    place.category ? `Category: ${place.category}` : null,
    place.rating != null
      ? `Rating: ${place.rating}${
          place.ratingCount != null ? ` (${place.ratingCount})` : ''
        }`
      : null,
  ].filter(Boolean)

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
        notes: notesParts.length > 0 ? notesParts.join('\n') : undefined,
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
        notes: notesParts.length > 0 ? notesParts.join('\n') : undefined,
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
      notes: notesParts.length > 0 ? notesParts.join('\n') : null,
      selectedAgentId: options.defaultAgentId || null,
    },
    select: { id: true },
  })

  return { leadId: created.id, created: true }
}

export function isBusinessLeadEmail(email: string | null | undefined): boolean {
  return isSyntheticBusinessEmail(email)
}
