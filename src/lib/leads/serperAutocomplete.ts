/**
 * Serper Google Autocomplete — used for Maps-style Find leads suggestions.
 * API: https://google.serper.dev/autocomplete
 */

export type SerperAutocompleteSuggestion = {
  value: string
}

type SerperAutocompleteResponse = {
  suggestions?: Array<{ value?: string } | string>
}

/**
 * Fetch Google-style autocomplete suggestions via Serper.
 */
export async function fetchSerperAutocomplete(options: {
  apiKey: string
  query: string
  gl?: string
  hl?: string
}): Promise<string[]> {
  const q = options.query.trim()
  if (q.length < 2) return []

  const res = await fetch('https://google.serper.dev/autocomplete', {
    method: 'POST',
    headers: {
      'X-API-KEY': options.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q,
      gl: options.gl || 'us',
      hl: options.hl || 'en',
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(
      `Serper Autocomplete failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ''}`,
    )
  }

  const data = (await res.json()) as SerperAutocompleteResponse
  const out: string[] = []
  const seen = new Set<string>()

  for (const item of data.suggestions || []) {
    const value =
      typeof item === 'string' ? item.trim() : String(item?.value || '').trim()
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
    if (out.length >= 10) break
  }

  return out
}
