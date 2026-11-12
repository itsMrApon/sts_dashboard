'use server'

import { revalidatePath } from 'next/cache'
import { ContextStatusEnum, type Prisma } from '@prisma/client'
import { onAuthenticateUser } from '@/actions/auth'
import { importServicesCatalogToTenant, publishTenantContext } from '@/actions/tenants'
import { prismaClient } from '@/lib/prismaClient'
import { getCreatorBusiness, type CreatorBusiness } from '@/lib/business/creatorBusiness'
import { PAID_ACCESS_ERROR, userHasPaidAccess } from '@/lib/billing/paidAccess'
import { generateReply } from '@/lib/messages/geminiText'
import { decryptToken } from '@/lib/messages/encrypt'
import { getUserVoiceCredentialByUserId } from '@/lib/voiceCredentialsRepo'
import { normalizeIndustryInput, type IndustryInput } from '@/lib/tenantContext'
import {
  sanitizeSiteContent,
  type BusinessSiteContent,
  type SiteSection,
  type SiteService,
} from '@/lib/business/siteContent'

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string }

async function myBusiness(): Promise<CreatorBusiness | null> {
  const auth = await onAuthenticateUser()
  if (!auth.user) return null
  return getCreatorBusiness(auth.user.id)
}

function revalidateBusiness() {
  revalidatePath('/messages', 'layout')
}

/**
 * Saves the Business page. Website content lives in core.site; services and socials are mirrored
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
    detailsLong: service.docs.map((doc) => [doc.name, doc.formCode, doc.issuer].filter(Boolean).join(' · ')).join('\n'),
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

/** Makes the saved content live for the AI, the public profile API and the website SDK. */
export async function publishBusinessSite(): Promise<ActionResult> {
  const business = await myBusiness()
  if (!business) return { ok: false, error: 'UNAUTHENTICATED' }
  if (!(await userHasPaidAccess(business.userId))) return { ok: false, error: PAID_ACCESS_ERROR }
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
      docs: [],
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
  if (!brief) return { ok: false, error: 'AI fill is not available for this section' }

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
