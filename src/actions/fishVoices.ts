'use server'

import { auth } from '@clerk/nextjs/server'
import { prismaClient } from '@/lib/prismaClient'
import { decryptToken } from '@/lib/messages/encrypt'
import { getUserVoiceCredentialByUserId } from '@/lib/voiceCredentialsRepo'

export type FishVoiceOption = {
  id: string
  title: string
  languages: string[]
  owned: boolean
}

export type FishVoiceLanguageFilter = 'all' | 'bn' | 'en'

function safeDecrypt(value: string | null | undefined): string | null {
  try {
    return decryptToken(value)
  } catch {
    return null
  }
}

function getEnvFishKey(): string | null {
  return process.env.FISH_API_KEY?.trim() || null
}

async function resolveFishApiKey(): Promise<string | null> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return getEnvFishKey()

  const user = await prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!user) return getEnvFishKey()

  const row = await getUserVoiceCredentialByUserId(user.id)
  return safeDecrypt(row?.fishApiKey) || getEnvFishKey()
}

type FishModelEntity = {
  _id?: string
  title?: string
  languages?: string[]
  state?: string
}

async function fetchFishModels(params: {
  apiKey: string
  self?: boolean
  title?: string
  language?: string
  pageSize?: number
}): Promise<FishModelEntity[]> {
  const qs = new URLSearchParams()
  qs.set('page_size', String(params.pageSize ?? 30))
  qs.set('page_number', '1')
  if (params.self) qs.set('self', 'true')
  if (params.title?.trim()) qs.set('title', params.title.trim())
  if (params.language?.trim()) qs.set('language', params.language.trim())

  const res = await fetch(`https://api.fish.audio/model?${qs.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${params.apiKey}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Fish Audio list failed (HTTP ${res.status})`)
  }

  const payload = (await res.json()) as { items?: FishModelEntity[] }
  return Array.isArray(payload.items) ? payload.items : []
}

function mapItem(
  item: FishModelEntity,
  ownedFlag: boolean,
): FishVoiceOption | null {
  const id = typeof item._id === 'string' ? item._id.trim() : ''
  if (!id) return null
  if (item.state && item.state !== 'trained') return null
  return {
    id,
    title: (item.title || id).trim(),
    languages: Array.isArray(item.languages) ? item.languages : [],
    owned: ownedFlag,
  }
}

function matchesLanguage(
  voice: FishVoiceOption,
  language: FishVoiceLanguageFilter,
): boolean {
  if (language === 'all') return true
  const langs = voice.languages.map((l) => l.toLowerCase())
  if (language === 'bn') {
    return langs.some(
      (l) =>
        l === 'bn' ||
        l.includes('bengali') ||
        l.includes('bangla') ||
        l.includes('বাংলা'),
    )
  }
  if (language === 'en') {
    return langs.some((l) => l === 'en' || l.includes('english'))
  }
  return true
}

/**
 * List Fish Audio voices the creator can pick as LiveKit TTS reference_id.
 * Prefers owned voices, then public catalog (optionally filtered by search/language).
 */
export async function listFishVoices(options?: {
  search?: string
  language?: FishVoiceLanguageFilter
}): Promise<{
  success: boolean
  data?: FishVoiceOption[]
  error?: string
}> {
  try {
    const apiKey = await resolveFishApiKey()
    if (!apiKey) {
      return {
        success: false,
        error:
          'Fish Audio API key is missing. Save it in Config Agent, then refresh voices.',
      }
    }

    const search = options?.search?.trim() || ''
    const language = options?.language || 'all'
    const apiLanguage = language === 'all' ? undefined : language

    const publicQueries: Promise<FishModelEntity[]>[] = [
      fetchFishModels({
        apiKey,
        self: false,
        title: search || undefined,
        language: apiLanguage,
        pageSize: 50,
      }),
    ]

    // Bangla voices are sparse in the default catalog; also search common titles.
    if (language === 'bn' && !search) {
      for (const title of ['bangla', 'bengali', 'বাংলা']) {
        publicQueries.push(
          fetchFishModels({
            apiKey,
            self: false,
            title,
            language: 'bn',
            pageSize: 30,
          }),
        )
        publicQueries.push(
          fetchFishModels({
            apiKey,
            self: false,
            title,
            pageSize: 30,
          }),
        )
      }
    }

    const [owned, ...publicBatches] = await Promise.all([
      fetchFishModels({
        apiKey,
        self: true,
        title: search || undefined,
        pageSize: 50,
      }),
      ...publicQueries,
    ])

    const byId = new Map<string, FishVoiceOption>()
    for (const item of owned) {
      const mapped = mapItem(item, true)
      if (mapped) byId.set(mapped.id, mapped)
    }
    for (const batch of publicBatches) {
      for (const item of batch) {
        const mapped = mapItem(item, false)
        if (mapped && !byId.has(mapped.id)) byId.set(mapped.id, mapped)
      }
    }

    let data = [...byId.values()]
    if (language !== 'all') {
      const filtered = data.filter((v) => matchesLanguage(v, language))
      // Keep owned voices even if language tags are missing when user filtered.
      const ownedAlways = data.filter((v) => v.owned)
      const merged = new Map<string, FishVoiceOption>()
      for (const v of [...ownedAlways, ...filtered]) merged.set(v.id, v)
      data = [...merged.values()]
    }

    data.sort((a, b) => {
      if (a.owned !== b.owned) return a.owned ? -1 : 1
      return a.title.localeCompare(b.title)
    })

    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list Fish voices',
    }
  }
}
