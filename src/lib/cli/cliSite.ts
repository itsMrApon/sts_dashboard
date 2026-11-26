import 'server-only'
import { prismaClient } from '@/lib/prismaClient'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'
import { normalizeOrigins } from '@/lib/embed/origin'
import { generateSiteKey, hashSiteKey } from '@/lib/embed/siteKey'

/**
 * Website setup for `npx @sts-ai/cli init`: the creator's site key and allowed website URLs,
 * made behind the scenes so nobody copies a key. A site key is only stored hashed, so getting
 * one for a new install means making a new one; when an older key exists the CLI asks first.
 */

export type CliSiteStatus = {
  configured: boolean
  allowedOrigins: string[]
  siteKeyPrefix: string | null
  businessName: string | null
}

export async function cliSiteStatus(userId: string): Promise<CliSiteStatus> {
  const business = await getCreatorBusiness(userId)
  if (!business) return { configured: false, allowedOrigins: [], siteKeyPrefix: null, businessName: null }
  const config = await prismaClient.roomEmbedConfig.findUnique({
    where: { roomName: business.roomName },
    select: { allowedOrigins: true, siteKeyPrefix: true, enabled: true },
  })
  return {
    configured: Boolean(config?.enabled),
    allowedOrigins: config?.allowedOrigins ?? [],
    siteKeyPrefix: config?.siteKeyPrefix ?? null,
    businessName: business.name,
  }
}

export type CliSiteSetup =
  | { ok: true; siteKey: string; allowedOrigins: string[]; businessName: string; replaced: boolean }
  | { ok: false; code: 'NO_BUSINESS' | 'NO_ORIGIN' | 'KEY_EXISTS'; allowedOrigins?: string[] }

/** Makes the site key (a new one replaces the old) and adds the website URLs to the allowlist. */
export async function setupCliSite(userId: string, input: { origins: string[]; replace: boolean }): Promise<CliSiteSetup> {
  const business = await getCreatorBusiness(userId)
  if (!business) return { ok: false, code: 'NO_BUSINESS' }
  const origins = normalizeOrigins(input.origins).slice(0, 10)
  if (origins.length === 0) return { ok: false, code: 'NO_ORIGIN' }

  const existing = await prismaClient.roomEmbedConfig.findUnique({
    where: { roomName: business.roomName },
    select: { allowedOrigins: true, enabled: true },
  })
  if (existing?.enabled && !input.replace) return { ok: false, code: 'KEY_EXISTS', allowedOrigins: existing.allowedOrigins }

  const siteKey = generateSiteKey()
  // The new site's addresses first: it is the one the creator is setting up now.
  const allowedOrigins = normalizeOrigins([...origins, ...(existing?.allowedOrigins ?? [])]).slice(0, 20)
  const key = { siteKeyHash: hashSiteKey(siteKey), siteKeyPrefix: siteKey.slice(0, 20) }
  await prismaClient.roomEmbedConfig.upsert({
    where: { roomName: business.roomName },
    create: {
      roomName: business.roomName,
      userId,
      workspaceId: business.workspaceId,
      publishProfileId: business.publishProfileId,
      allowedOrigins,
      enabled: true,
      ...key,
    },
    update: { allowedOrigins, enabled: true, rotatedAt: new Date(), ...key },
  })
  return { ok: true, siteKey, allowedOrigins, businessName: business.name, replaced: Boolean(existing) }
}
