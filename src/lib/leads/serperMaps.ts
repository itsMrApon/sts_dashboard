/**
 * Serper Maps client for local business discovery (cold outreach targets).
 * API: https://google.serper.dev/maps
 */

export type SerperMapPlace = {
  placeId: string
  title: string
  address: string | null
  phone: string | null
  website: string | null
  rating: number | null
  ratingCount: number | null
  category: string | null
  latitude: number | null
  longitude: number | null
}

type SerperMapsPlaceRaw = {
  placeId?: string
  cid?: string
  title?: string
  address?: string
  phoneNumber?: string
  website?: string
  rating?: number
  ratingCount?: number
  type?: string
  types?: string[]
  latitude?: number
  longitude?: number
}

type SerperMapsResponse = {
  places?: SerperMapsPlaceRaw[]
  localResults?: SerperMapsPlaceRaw[]
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed
}

function resolvePlaceId(raw: SerperMapsPlaceRaw, index: number): string {
  const fromApi = (raw.placeId || raw.cid || '').trim()
  if (fromApi) return fromApi.slice(0, 100)
  const slug = [raw.title, raw.address, raw.phoneNumber]
    .filter(Boolean)
    .join('|')
    .toLowerCase()
    .replace(/[^a-z0-9|]+/g, '-')
    .slice(0, 80)
  return (slug || `place-${index}`).slice(0, 100)
}

function normalizePlace(
  raw: SerperMapsPlaceRaw,
  index: number,
): SerperMapPlace | null {
  const title = truncate(raw.title, 255)
  if (!title) return null
  const category =
    truncate(raw.type, 100) ||
    (Array.isArray(raw.types) && raw.types[0]
      ? truncate(String(raw.types[0]), 100)
      : null)
  return {
    placeId: resolvePlaceId(raw, index),
    title,
    address: truncate(raw.address, 500),
    phone: truncate(raw.phoneNumber, 50),
    website: truncate(raw.website, 500),
    rating: typeof raw.rating === 'number' ? raw.rating : null,
    ratingCount: typeof raw.ratingCount === 'number' ? raw.ratingCount : null,
    category,
    latitude: typeof raw.latitude === 'number' ? raw.latitude : null,
    longitude: typeof raw.longitude === 'number' ? raw.longitude : null,
  }
}

export function buildBusinessMapsQuery(niche: string, location: string): string {
  const n = niche.trim()
  const loc = location.trim()
  return `${n} in ${loc}`
}

export function syntheticBusinessEmail(placeId: string): string {
  const slug = placeId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180)
  return `business+${slug || 'unknown'}@business.local`
}

export function isSyntheticBusinessEmail(
  email: string | null | undefined,
): boolean {
  return Boolean(email?.toLowerCase().endsWith('@business.local'))
}

/**
 * Search Serper Maps for local businesses matching niche + location.
 */
export async function searchSerperMaps(options: {
  apiKey: string
  niche: string
  location: string
  limit?: number
}): Promise<SerperMapPlace[]> {
  const query = buildBusinessMapsQuery(options.niche, options.location)
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 20)

  const res = await fetch('https://google.serper.dev/maps', {
    method: 'POST',
    headers: {
      'X-API-KEY': options.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(
      `Serper Maps failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ''}`,
    )
  }

  const data = (await res.json()) as SerperMapsResponse
  const rawPlaces = data.places || data.localResults || []
  const places: SerperMapPlace[] = []
  const seen = new Set<string>()

  for (let i = 0; i < rawPlaces.length; i++) {
    const place = normalizePlace(rawPlaces[i], i)
    if (!place) continue
    if (seen.has(place.placeId)) continue
    seen.add(place.placeId)
    places.push(place)
    if (places.length >= limit) break
  }

  return places
}
