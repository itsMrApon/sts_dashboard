/**
 * Curated Maps-style Find suggestions + cleanup for Serper autocomplete.
 * Mirrors how Google Maps / local SERP queries are phrased: "{niche} in {location}".
 */

/** High-intent local business types that work well with Serper Maps. */
export const MAPS_NICHE_SUGGESTIONS: string[] = [
  'dental clinics',
  'dentists',
  'orthodontists',
  'medical clinics',
  'dermatologists',
  'physiotherapy clinics',
  'veterinary clinics',
  'pharmacies',
  'restaurants',
  'cafes',
  'bakeries',
  'gyms',
  'yoga studios',
  'spas',
  'hair salons',
  'barbershops',
  'beauty salons',
  'law firms',
  'accountants',
  'real estate agencies',
  'property management',
  'insurance agencies',
  'marketing agencies',
  'web design agencies',
  'software companies',
  'IT services',
  'coworking spaces',
  'hotels',
  'boutiques',
  'clothing stores',
  'furniture stores',
  'car dealerships',
  'auto repair shops',
  'plumbing services',
  'electricians',
  'HVAC services',
  'cleaning services',
  'schools',
  'tutoring centers',
  'daycares',
]

/** Common area / city patterns users type into Maps. Seeded globally + BD-heavy. */
export const MAPS_LOCATION_SUGGESTIONS: string[] = [
  'Gulshan, Dhaka',
  'Banani, Dhaka',
  'Dhanmondi, Dhaka',
  'Uttara, Dhaka',
  'Mirpur, Dhaka',
  'Motijheel, Dhaka',
  'Bashundhara, Dhaka',
  'Chittagong',
  'Sylhet',
  'New York, NY',
  'Los Angeles, CA',
  'Austin, TX',
  'London, UK',
  'Dubai, UAE',
  'Singapore',
  'Toronto, Canada',
]

const NEAR_ME_RE = /\s+near\s+me\b/gi
const IN_LOCATION_RE = /\s+in\s+.+$/i
const AROUND_RE = /\s+(around|close to|near)\s+.+$/i

/** Turn noisy autocomplete ("dentists near me") into a clean niche. */
export function cleanNicheSuggestion(raw: string): string {
  let s = raw.trim()
  s = s.replace(NEAR_ME_RE, '')
  s = s.replace(IN_LOCATION_RE, '')
  s = s.replace(AROUND_RE, '')
  s = s.replace(/\s{2,}/g, ' ').trim()
  // Drop leading articles for chip polish
  s = s.replace(/^(best|top|cheap|affordable)\s+/i, '').trim()
  return s.slice(0, 120)
}

/** Prefer place-like suggestions; strip "restaurants in …" down to the place. */
export function cleanLocationSuggestion(raw: string, typed: string): string {
  let s = raw.trim()
  const inMatch = s.match(/\bin\s+(.+)$/i)
  if (inMatch?.[1] && typed.length >= 2) {
    const place = inMatch[1].trim()
    if (place.toLowerCase().includes(typed.toLowerCase()) || typed.length <= 4) {
      s = place
    }
  }
  s = s.replace(/^(near|around|in)\s+/i, '').trim()
  return s.slice(0, 120)
}

export function filterCurated(
  list: string[],
  query: string,
  limit = 8,
): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return list.slice(0, limit)
  return list
    .filter((item) => item.toLowerCase().includes(q))
    .slice(0, limit)
}

export function buildMapsFindPreview(niche: string, location: string): string {
  const n = niche.trim()
  const loc = location.trim()
  if (n && loc) return `${n} in ${loc}`
  if (n) return `${n} in …`
  if (loc) return `… in ${loc}`
  return 'business type in location'
}

export function mergeUniqueSuggestions(
  ...groups: Array<string[] | undefined>
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const group of groups) {
    for (const item of group || []) {
      const value = item.trim()
      if (!value) continue
      const key = value.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(value)
    }
  }
  return out
}
