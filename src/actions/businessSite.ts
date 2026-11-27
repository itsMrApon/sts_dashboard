'use server'

import { revalidatePath } from 'next/cache'
import { ContextStatusEnum, type Prisma } from '@prisma/client'
import { onAuthenticateUser } from '@/actions/auth'
import { importServicesCatalogToTenant, publishTenantContext } from '@/actions/tenants'
import { prismaClient } from '@/lib/prismaClient'
import { getCreatorBusiness, type CreatorBusiness } from '@/lib/business/creatorBusiness'
import { PAID_ACCESS_ERROR, userCanGoLive } from '@/lib/billing/paidAccess'
import { getWebsiteConnection } from '@/lib/embed/websiteConnection'
import { WEBSITE_REQUIRED_ERROR } from '@/lib/embed/websiteConnectionShared'
import { generateReply } from '@/lib/messages/geminiText'
import { decryptToken } from '@/lib/messages/encrypt'
import { getUserVoiceCredentialByUserId } from '@/lib/voiceCredentialsRepo'
import { normalizeIndustryInput, type IndustryInput } from '@/lib/tenantContext'
import {
  newId,
  sanitizeSiteContent,
  siteContentFromLegacy,
  SITE_LIMITS,
  type BusinessSiteContent,
  type SiteSection,
  type SiteService,
  type SocialAccount,
} from '@/lib/business/siteContent'
import { detectSocialProfiles, type DetectedSocial } from '@/lib/business/socialLinks'
import { publicLink } from '@/lib/agents/assistantDraft'
import { enrichWebsiteViaScrapeAgent, isScrapeAgentConfigured } from '@/lib/leads/scrapeAgentClient'
import { resolveSerperApiKey } from '@/lib/leads/webResearch'

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string }

async function myBusiness(): Promise<CreatorBusiness | null> {
  const auth = await onAuthenticateUser()
  if (!auth.user) return null
  return getCreatorBusiness(auth.user.id)
}

function revalidateBusiness() {
  revalidatePath('/services', 'layout')
}

/**
 * Saves the website services' content (Menu, Docs, Links, Contact). Website content lives in core.site; services and socials are mirrored
 * into the legacy industry/social JSON so the AI context and public profile keep working.
 */
export async function saveBusinessSite(
  input: BusinessSiteContent,
): Promise<ActionResult<{ content: BusinessSiteContent; status: ContextStatusEnum }>> {
  const business = await myBusiness()
  if (!business) return { ok: false, error: 'UNAUTHENTICATED' }

  const content = sanitizeSiteContent(input, business.name)
  const workspace = await prismaClient.workspace.findUnique({
    where: { id: business.workspaceId },
    select: { contextIndustryJson: true, contextStatus: true },
  })
  const industry = normalizeIndustryInput(workspace?.contextIndustryJson as IndustryInput | null)
  const typeSort = content.services.map((service, index) => ({
    type: content.advanced.vertical || 'other',
    category: service.category,
    title: service.name,
    description: service.summary,
    detailsShort: service.summary,
    detailsLong: content.docs
      .filter((doc) => doc.serviceIds.includes(service.id))
      .map((doc) => [doc.name, doc.formCode, doc.issuer].filter(Boolean).join(' · '))
      .join('\n'),
    price: service.price,
    sortOrder: index + 1,
    isActive: service.active,
  }))
  const social = {
    socials: content.social.accounts.map((account) => ({
      platform: account.platform.toUpperCase(),
      handle: account.handle,
      url: account.url,
    })),
    websiteUrl: content.advanced.websiteUrl,
  }
  const core = { termsAndConditions: content.advanced.termsAndConditions, site: content }
  const status =
    workspace?.contextStatus === ContextStatusEnum.PUBLISHED || workspace?.contextStatus === ContextStatusEnum.STALE
      ? ContextStatusEnum.STALE
      : ContextStatusEnum.DRAFT

  await prismaClient.workspace.update({
    where: { id: business.workspaceId },
    data: {
      contextVertical: content.advanced.vertical || null,
      contextCoreJson: core as unknown as Prisma.InputJsonObject,
      contextIndustryJson: { ...industry, typeSort } as Prisma.InputJsonObject,
      contextSocialJson: social,
      fullProfileJson: { core, industry: { ...industry, typeSort }, social } as unknown as Prisma.InputJsonObject,
      contextStatus: status,
    },
  })
  revalidateBusiness()
  return { ok: true, content, status }
}

/**
 * Onboarding: a few tags to find the business online later (@handles, domains, names). Saved
 * only; the scrape agent researches them once the creator has an AI key. A domain-looking tag
 * also fills the website when none is set.
 */
export async function saveBusinessLookupTags(input: { tags?: string[] }): Promise<ActionResult<{ tags: string[] }>> {
  const business = await myBusiness()
  if (!business) return { ok: false, error: 'UNAUTHENTICATED' }
  const workspace = await prismaClient.workspace.findUnique({
    where: { id: business.workspaceId },
    select: { contextVertical: true, contextCoreJson: true, contextIndustryJson: true, contextSocialJson: true },
  })
  const current = siteContentFromLegacy({
    businessName: business.name,
    vertical: workspace?.contextVertical ?? null,
    core: workspace?.contextCoreJson,
    industry: workspace?.contextIndustryJson,
    social: workspace?.contextSocialJson,
  })
  const tags = (Array.isArray(input.tags) ? input.tags : []).filter((tag): tag is string => typeof tag === 'string')
  const domain = tags.find((tag) => !tag.startsWith('@') && /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(tag.trim()))
  const websiteUrl = current.advanced.websiteUrl || (domain ? (/^https?:\/\//i.test(domain) ? domain : `https://${domain}`) : '')

  const saved = await saveBusinessSite({
    ...current,
    advanced: { ...current.advanced, websiteUrl, lookupTags: [...current.advanced.lookupTags, ...tags] },
  })
  return saved.ok ? { ok: true, tags: saved.content.advanced.lookupTags } : saved
}

/** Makes the saved content live for the AI, the public profile API and the website SDK. */
export async function publishBusinessSite(): Promise<ActionResult> {
  const business = await myBusiness()
  if (!business) return { ok: false, error: 'UNAUTHENTICATED' }
  if (!(await userCanGoLive(business.userId))) return { ok: false, error: PAID_ACCESS_ERROR }
  // The first publish needs the website connection; re-publishing an already live site does not.
  const workspace = await prismaClient.workspace.findUnique({ where: { id: business.workspaceId }, select: { publishedAt: true } })
  if (!workspace?.publishedAt && !(await getWebsiteConnection(business.roomName)).connected) {
    return { ok: false, error: WEBSITE_REQUIRED_ERROR }
  }
  const result = await publishTenantContext(business.workspaceId)
  if (!result.success) return { ok: false, error: result.error || 'Publish failed' }
  revalidateBusiness()
  return { ok: true }
}

/** CSV / SQL services file → service rows (the client merges them into the editor). */
export async function importServicesFile(fileContent: string): Promise<ActionResult<{ services: Partial<SiteService>[] }>> {
  const business = await myBusiness()
  if (!business) return { ok: false, error: 'UNAUTHENTICATED' }
  const result = await importServicesCatalogToTenant(business.workspaceId, { content: fileContent })
  if (!result.success || !result.typeSort) return { ok: false, error: result.error || 'Import failed' }
  return {
    ok: true,
    services: result.typeSort.map((row) => ({
      name: row.title,
      category: row.category,
      summary: row.description || row.detailsShort,
      price: row.price,
      active: row.isActive !== false,
    })),
  }
}

// ── AI fill ────────────────────────────────────────────────────────────────

const SECTION_BRIEFS: Partial<Record<SiteSection, string>> = {
  seo: 'Return {"seo":{"title":"max 60 chars, business name + main offer","description":"max 155 chars, benefit-led, includes location if known"}}.',
  footer:
    'Return {"footer":{"tagline":"one short memorable line","copyright":"© YEAR NAME. All rights reserved."}}. Do not invent emails or URLs.',
  services:
    'Return {"services":[{"name","category","summary (1-2 sentences)","price (only if given)","docs":[{"name","formCode","issuer"}]}]}. Improve existing services first; you may add common services for this business type (max 16 total). Only list documents/forms that really exist for that service and jurisdiction (e.g. official government form codes); if unsure, leave docs empty. Never invent prices.',
  keyDates:
    'Return {"keyDates":[{"date":"YYYY-MM-DD","title","serviceName","note"}]} for the next 12 months: only well-known public deadlines or seasons relevant to these services and jurisdiction. Leave perk, gift and govFee out — the business adds them. If nothing is certain, return an empty list.',
}

export async function draftBusinessSection(
  section: SiteSection,
  current: BusinessSiteContent,
): Promise<ActionResult<{ patch: Partial<BusinessSiteContent> }>> {
  const business = await myBusiness()
  if (!business) return { ok: false, error: 'UNAUTHENTICATED' }
  const brief = SECTION_BRIEFS[section]
  // "Look" holds design choices, not copy: nothing for the AI to write.
  // Docs holds real form codes and PDFs: never AI-made.
  if (!brief || section === 'look' || section === 'docs') return { ok: false, error: 'AI fill is not available for this section' }

  let apiKey: string | null = null
  try {
    apiKey = decryptToken((await getUserVoiceCredentialByUserId(business.userId))?.googleApiKey) || null
  } catch {
    apiKey = null
  }

  const content = sanitizeSiteContent(current, business.name)
  const result = await generateReply({
    userMessage: JSON.stringify({
      businessName: business.name,
      description: business.description,
      vertical: content.advanced.vertical,
      websiteUrl: content.advanced.websiteUrl,
      today: new Date().toISOString().slice(0, 10),
      existing: { seo: content.seo, footer: content.footer, services: content.services, keyDates: content.keyDates },
    }),
    history: [],
    systemPrompt: [
      'You fill in website content for a small business. Use only the facts given plus well-established public knowledge.',
      'Match the language of the business description (Bangla or English). Return ONLY minified JSON, no prose.',
      brief,
    ].join('\n'),
    apiKey,
    accountUserId: business.userId,
    usageSurface: 'messages',
  })
  if (!result.ok) return { ok: false, error: result.error }

  const start = result.text.indexOf('{')
  const end = result.text.lastIndexOf('}')
  let parsed: Record<string, unknown> = {}
  try {
    parsed = start >= 0 && end > start ? JSON.parse(result.text.slice(start, end + 1)) : {}
  } catch {
    return { ok: false, error: 'AI returned an unreadable draft — try again' }
  }

  // Keep ids of services the AI rewrote, so key dates stay linked.
  if (section === 'services' && Array.isArray(parsed.services)) {
    const byName = new Map(content.services.map((service) => [service.name.toLowerCase(), service.id]))
    parsed.services = (parsed.services as Record<string, unknown>[]).map((row) => ({
      ...row,
      id: byName.get(String(row.name ?? '').toLowerCase()),
    }))
  }

  // Map AI service names on key dates to existing service ids.
  if (section === 'keyDates' && Array.isArray(parsed.keyDates)) {
    const byName = new Map(content.services.map((service) => [service.name.toLowerCase(), service.id]))
    parsed.keyDates = (parsed.keyDates as Record<string, unknown>[]).map((row) => ({
      ...row,
      serviceId: byName.get(String(row.serviceName ?? '').toLowerCase()) ?? '',
    }))
  }

  const merged = sanitizeSiteContent({ ...content, ...parsed, [section]: section === 'seo' || section === 'footer' ? { ...content[section], ...(parsed[section] as object) } : parsed[section] }, business.name)
  return { ok: true, patch: { [section]: merged[section] } }
}

// ── Grab from my website (Contact + Links) ──────────────────────────

export type WebsiteFillResult = {
  /** Contact and Links with the found details added. Nothing the creator typed is replaced. */
  patch: Pick<BusinessSiteContent, 'footer' | 'social'>
  /** What was added, for the toast (e.g. "phone", "Instagram"). */
  added: string[]
  /** The page that was read. */
  source: string
  /** Accounts found by a Google search (Serper) rather than on the website: worth a second look. */
  fromSearch: string[]
}

/** Platforms worth a search when the website doesn't link them. */
const SEARCHED_PLATFORMS = ['instagram', 'tiktok', 'facebook', 'linkedin'] as const

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  x: 'X',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
}

const nameTokens = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4)

/** A search result only counts when its handle carries part of the business name. */
function looksLikeBusiness(profile: DetectedSocial, businessName: string): boolean {
  const handle = profile.handle.toLowerCase().replace(/[^a-z0-9]/g, '')
  return nameTokens(businessName).some((token) => handle.includes(token))
}

/** Social profiles for the platforms the website didn't link, from the creator's own Serper key. */
async function searchMissingSocials(userId: string, businessName: string, location: string, missing: string[]): Promise<DetectedSocial[]> {
  if (missing.length === 0) return []
  const serperKey = await resolveSerperApiKey(userId)
  if (!serperKey) return []
  const query = `"${businessName}" ${location} ${missing.map((platform) => PLATFORM_LABEL[platform]).join(' OR ')}`.trim()
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 10 }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { organic?: { link?: string }[] }
    return detectSocialProfiles((data.organic ?? []).map((item) => item.link ?? '').filter(Boolean)).filter(
      (profile) => missing.includes(profile.platform) && looksLikeBusiness(profile, businessName),
    )
  } catch (error) {
    console.error('[fillFromWebsite] Serper search failed', error instanceof Error ? error.message : error)
    return []
  }
}

/**
 * Reads the creator's website with the scrape agent and fills the empty parts of Contact
 * (email, phone, address, hours, map, trust badges) and Links (social accounts). Social accounts
 * the website doesn't link are searched with the creator's Serper key from Lead settings. Returns a
 * patch for the editor only: the creator reviews it and saves; nothing is saved or published here.
 */
export async function fillFromWebsite(current: BusinessSiteContent): Promise<ActionResult<WebsiteFillResult>> {
  const business = await myBusiness()
  if (!business) return { ok: false, error: 'UNAUTHENTICATED' }
  const content = sanitizeSiteContent(current, business.name)

  const connection = await getWebsiteConnection(business.roomName)
  const source = publicLink(content.advanced.websiteUrl || connection.origin || '')
  if (!source) {
    return {
      ok: false,
      error: connection.origin
        ? `Your connected website (${connection.origin}) is not public, so it can't be read. Connect your public website first`
        : 'Connect your website first (Connection, at the top of Services)',
    }
  }
  if (!isScrapeAgentConfigured()) return { ok: false, error: 'The website reader is not running right now. Try again later' }

  let geminiApiKey: string | null = null
  try {
    geminiApiKey = decryptToken((await getUserVoiceCredentialByUserId(business.userId))?.googleApiKey) || null
  } catch {
    geminiApiKey = null
  }
  const read = await enrichWebsiteViaScrapeAgent({ url: source, userId: business.userId, geminiApiKey, timeoutMs: 90_000 })
  if (!read.ok) return { ok: false, error: `Could not read ${source}: ${read.error}` }
  const found = read.data.enrichment

  const added: string[] = []
  const footer = { ...content.footer }
  const fillText = (key: 'email' | 'phone' | 'address' | 'hours' | 'mapUrl', value: string | null | undefined, label: string) => {
    if (!footer[key] && value?.trim()) {
      footer[key] = value.trim()
      added.push(label)
    }
  }
  fillText('email', found.contactEmails?.find((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)), 'email')
  fillText('phone', found.contactPhones?.[0], 'phone')
  fillText('address', found.address, 'address')
  fillText('hours', found.openingHours, 'hours')
  fillText('mapUrl', found.mapUrl, 'map link')
  if (footer.credentials.length === 0 && found.credentials?.length) {
    footer.credentials = found.credentials.slice(0, SITE_LIMITS.credentials)
    added.push('trust badges')
  }

  const accounts: SocialAccount[] = [...content.social.accounts]
  const has = (profile: DetectedSocial) =>
    accounts.some(
      (account) =>
        account.platform === profile.platform && account.handle.replace(/^@/, '').toLowerCase() === profile.handle.toLowerCase(),
    )
  const addAccounts = (profiles: DetectedSocial[]) => {
    const names: string[] = []
    for (const profile of profiles) {
      if (accounts.length >= SITE_LIMITS.accounts || has(profile)) continue
      accounts.push({ id: newId(), ...profile })
      names.push(PLATFORM_LABEL[profile.platform] ?? profile.platform)
    }
    return names
  }
  added.push(...addAccounts(detectSocialProfiles(found.socialLinks ?? [])))

  const covered = new Set(accounts.map((account) => account.platform))
  const missing = SEARCHED_PLATFORMS.filter((platform) => !covered.has(platform))
  const fromSearch = addAccounts(await searchMissingSocials(business.userId, business.name, content.advanced.location, missing))
  added.push(...fromSearch)

  const merged = sanitizeSiteContent({ ...content, footer, social: { ...content.social, accounts } }, business.name)
  return { ok: true, patch: { footer: merged.footer, social: merged.social }, added, source, fromSearch }
}
