import { GoogleGenerativeAI } from '@google/generative-ai'
import { DEFAULT_LLM_MODEL } from '@/lib/llm/defaultModel'
import { decryptToken } from '@/lib/messages/encrypt'
import { generateReply } from '@/lib/messages/geminiText'
import { prismaClient } from '@/lib/prismaClient'
import { resolveUserGeminiApiKey } from '@/lib/leads/resolveUserLlmKey'
import { recordProviderUsageLater } from '@/lib/usage/providerUsage'

/**
 * Resolve Serper key: per-user encrypted key first, then env fallback.
 */
export async function resolveSerperApiKey(
  userId?: string | null,
): Promise<string | null> {
  if (userId) {
    const settings = await prismaClient.callIntelSettings.findUnique({
      where: { userId },
      select: { serperApiKeyEnc: true },
    })
    const fromUser = decryptToken(settings?.serperApiKeyEnc)
    if (fromUser?.trim()) return fromUser.trim()
  }
  const fromEnv = process.env.SERPER_API_KEY?.trim()
  return fromEnv || null
}

export type WebsiteEnrichmentSnapshot = {
  url: string
  scrapedAt: string
  provider: 'scrapegraph-ai'
  error?: string | null
  companySummary?: string | null
  services?: string[]
  contactEmails?: string[]
  contactPhones?: string[]
  socialLinks?: string[]
  highlights?: string[]
  flags?: string[]
  raw?: unknown
}

export type WebResearchDossier = {
  query: string
  flags: string[]
  highlights: string[]
  sources: Array<{ title: string; link: string; snippet: string }>
  locationGuess: string | null
  generatedAt: string
  /** How live web context was obtained */
  provider: 'serper' | 'gemini-grounding' | 'model-only' | 'scrapegraph'
  /** Deep website scrape via Python ScrapeGraphAI worker */
  websiteEnrichment?: WebsiteEnrichmentSnapshot | null
}

type SerperOrganic = {
  title?: string
  link?: string
  snippet?: string
}

type GroundingChunk = {
  web?: { uri?: string; title?: string }
}

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    groundingMetadata?: {
      groundingChunks?: GroundingChunk[]
      webSearchQueries?: string[]
    }
  }>
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
  }
  error?: { message?: string }
}

function parseDossierJson(text: string): {
  flags: string[]
  highlights: string[]
  locationGuess: string | null
} {
  try {
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
    const raw = fence ? fence[1] : text
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      flags?: unknown
      highlights?: unknown
      locationGuess?: unknown
    }
    return {
      flags: Array.isArray(parsed.flags)
        ? parsed.flags.filter((x): x is string => typeof x === 'string').slice(0, 10)
        : [],
      highlights: Array.isArray(parsed.highlights)
        ? parsed.highlights
            .filter((x): x is string => typeof x === 'string')
            .slice(0, 10)
        : [],
      locationGuess:
        typeof parsed.locationGuess === 'string' && parsed.locationGuess.trim()
          ? parsed.locationGuess.trim()
          : null,
    }
  } catch {
    return {
      flags: [],
      highlights: ['Could not parse research JSON; review sources manually.'],
      locationGuess: null,
    }
  }
}

function buildPrompt(options: {
  name: string
  email: string
  company: string
  domain: string
  sourceBlock: string
}): string {
  return `Build a short pre-call research dossier for a sales lead.
Return ONLY JSON:
{
  "flags": string[] // notable risks or opportunities (verify before trusting)
  "highlights": string[] // useful talking points
  "locationGuess": string | null // approximate location if strongly suggested, else null
}

Lead: ${options.name}
Email: ${options.email}
Company: ${options.company || 'unknown'}
Domain: ${options.domain || 'unknown'}

Search results / context:
${options.sourceBlock.slice(0, 10000)}`
}

/**
 * Free path: Gemini Developer API + Google Search grounding (GOOGLE_API_KEY).
 * Uses REST because @google/generative-ai only exposes the older googleSearchRetrieval tool.
 */
async function researchWithGeminiGrounding(options: {
  apiKey: string
  modelName: string
  prompt: string
  systemPrompt: string
  accountUserId?: string | null
}): Promise<{
  text: string
  sources: WebResearchDossier['sources']
} | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.modelName)}:generateContent?key=${encodeURIComponent(options.apiKey)}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: options.systemPrompt }],
        },
        contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
        tools: [{ google_search: {} }],
      }),
    })

    const data = (await res.json()) as GeminiGenerateResponse
    if (!res.ok) {
      console.error('Gemini grounding failed', data.error?.message || res.status)
      return null
    }

    const candidate = data.candidates?.[0]
    const text =
      candidate?.content?.parts
        ?.map((p) => p.text || '')
        .join('')
        .trim() || ''
    if (!text) return null

    if (options.accountUserId) {
      recordProviderUsageLater({
        userId: options.accountUserId,
        provider: 'google',
        kind: 'llm',
        surface: 'leads',
        requestCount: 1,
        inputUnits: Number(data.usageMetadata?.promptTokenCount || 0),
        outputUnits: Number(data.usageMetadata?.candidatesTokenCount || 0),
      })
    }

    const sources: WebResearchDossier['sources'] = []
    for (const chunk of candidate?.groundingMetadata?.groundingChunks || []) {
      const link = chunk.web?.uri?.trim()
      if (!link) continue
      sources.push({
        title: chunk.web?.title || link,
        link,
        snippet: '',
      })
    }

    return { text, sources }
  } catch (err) {
    console.error('Gemini grounding request error', err)
    return null
  }
}

/**
 * Public web research for a lead (name + email domain).
 *
 * Priority:
 * 1. Serper (optional paid) when SERPER_API_KEY is set
 * 2. Gemini Google Search grounding (free with GOOGLE_API_KEY / AI Studio)
 * 3. Model-only synthesis (no live web)
 */
export async function webResearchLead(options: {
  name: string
  email: string
  company?: string | null
  geminiApiKey?: string | null
  /** Optional; when omitted, env SERPER_API_KEY is used if present */
  serperApiKey?: string | null
  userId?: string | null
}): Promise<WebResearchDossier> {
  const email = (options.email || '').trim().toLowerCase()
  const domain =
    email.includes('@') &&
    !email.endsWith('@fathom.local') &&
    !email.endsWith('@business.local')
      ? email.split('@')[1]
      : ''
  const company = options.company?.trim() || ''
  const name = options.name.trim() || email || 'Unknown lead'
  const query = [name, company, domain].filter(Boolean).join(' ')

  let sources: WebResearchDossier['sources'] = []
  let provider: WebResearchDossier['provider'] = 'model-only'
  const serperKey =
    options.serperApiKey?.trim() ||
    (await resolveSerperApiKey(options.userId)) ||
    null
  // Prefer explicit key, else Config Agent key for this user, else env
  const apiKey =
    options.geminiApiKey?.trim() ||
    (options.userId ? await resolveUserGeminiApiKey(options.userId) : null) ||
    process.env.GOOGLE_API_KEY?.trim() ||
    ''

  const systemPrompt =
    'You prepare cautious sales research. Prefer verifiable claims. JSON only.'

  if (serperKey) {
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': serperKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, num: 8 }),
      })
      if (res.ok) {
        const data = (await res.json()) as { organic?: SerperOrganic[] }
        for (const item of data.organic || []) {
          if (!item.link) continue
          sources.push({
            title: item.title || item.link,
            link: item.link,
            snippet: item.snippet || '',
          })
        }
        if (sources.length > 0) provider = 'serper'
      }
    } catch (err) {
      console.error('Serper search failed', err)
    }
  }

  // Free live web: Gemini Search grounding when no Serper hits
  if (provider === 'model-only' && apiKey) {
    const groundedPrompt = buildPrompt({
      name,
      email,
      company,
      domain,
      sourceBlock:
        'Use Google Search to find current public info about this lead/company. Cite only what search supports.',
    })
    const grounded = await researchWithGeminiGrounding({
      apiKey,
      modelName: DEFAULT_LLM_MODEL,
      prompt: groundedPrompt,
      systemPrompt,
      accountUserId: options.userId,
    })
    if (grounded) {
      const parsed = parseDossierJson(grounded.text)
      return {
        query,
        flags: parsed.flags,
        highlights: parsed.highlights,
        sources: grounded.sources,
        locationGuess: parsed.locationGuess,
        generatedAt: new Date().toISOString(),
        provider: 'gemini-grounding',
      }
    }

    // Older models: try googleSearchRetrieval via SDK
    try {
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({
        model: DEFAULT_LLM_MODEL,
        tools: [{ googleSearchRetrieval: {} }],
        systemInstruction: {
          role: 'system',
          parts: [{ text: systemPrompt }],
        },
      })
      const result = await model.generateContent(groundedPrompt)
      const text = result.response.text()
      if (options.userId) {
        const usage = result.response.usageMetadata
        recordProviderUsageLater({
          userId: options.userId,
          provider: 'google',
          kind: 'llm',
          requestCount: 1,
          inputUnits: Number(usage?.promptTokenCount || 0),
          outputUnits: Number(usage?.candidatesTokenCount || 0),
        })
      }
      const meta = result.response.candidates?.[0]?.groundingMetadata
      const retrievalSources: WebResearchDossier['sources'] = []
      for (const chunk of meta?.groundingChunks || []) {
        const link = chunk.web?.uri?.trim()
        if (!link) continue
        retrievalSources.push({
          title: chunk.web?.title || link,
          link,
          snippet: '',
        })
      }
      if (text?.trim()) {
        const parsed = parseDossierJson(text)
        return {
          query,
          flags: parsed.flags,
          highlights: parsed.highlights,
          sources: retrievalSources,
          locationGuess: parsed.locationGuess,
          generatedAt: new Date().toISOString(),
          provider:
            retrievalSources.length > 0 ? 'gemini-grounding' : 'model-only',
        }
      }
    } catch (err) {
      console.error('googleSearchRetrieval fallback failed', err)
    }
  }

  const sourceBlock =
    sources.length > 0
      ? sources
          .map((s, i) => `${i + 1}. ${s.title}\n${s.link}\n${s.snippet}`)
          .join('\n\n')
      : 'No live search results. Infer cautiously from the name/email/company only and mark uncertainty.'

  const prompt = buildPrompt({ name, email, company, domain, sourceBlock })

  const result = await generateReply({
    userMessage: prompt,
    history: [],
    systemPrompt,
    apiKey, // always the resolved Config Agent / env key
    accountUserId: options.userId,
    usageSurface: 'leads',
  })

  let flags: string[] = []
  let highlights: string[] = []
  let locationGuess: string | null = null

  if (result.ok) {
    const parsed = parseDossierJson(result.text)
    flags = parsed.flags
    highlights = parsed.highlights
    locationGuess = parsed.locationGuess
  } else {
    flags = [result.error]
  }

  if (provider === 'model-only') {
    flags = [
      apiKey
        ? 'Live web grounding unavailable — research is model-only and may be incomplete.'
        : 'Gemini key missing — add it in Config Agent (/ai-agents/config).',
      ...flags,
    ]
  }

  return {
    query,
    flags,
    highlights,
    sources,
    locationGuess,
    generatedAt: new Date().toISOString(),
    provider,
  }
}
