'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { auth } from '@clerk/nextjs/server'
import { prismaClient } from '@/lib/prismaClient'
import { decryptToken } from '@/lib/messages/encrypt'
import {
  enrichWebsiteViaScrapeAgent,
  isScrapeAgentConfigured,
  toLeadWebsiteScrape,
} from '@/lib/leads/scrapeAgentClient'

type ActionResult = { ok: true } | { ok: false; error: string }

async function requireDbUser() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return null
  return prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
}

async function resolveGeminiApiKey(userId: string): Promise<string | null> {
  const row = await prismaClient.userVoiceCredential.findUnique({
    where: { userId },
    select: { googleApiKey: true },
  })
  const stored = row?.googleApiKey?.trim() || null
  let fromUser: string | null = null
  if (stored) {
    try {
      fromUser = decryptToken(stored)?.trim() || stored
    } catch {
      fromUser = stored
    }
  }
  return fromUser || process.env.GOOGLE_API_KEY?.trim() || null
}

/**
 * ScrapeGraphAI website enrichment for a hunted (Google) lead.
 * This is the lead "summary" surface — replaces Fathom-style call summaries
 * for outbound Google leads that have a website.
 */
export async function refreshLeadWebsiteScrape(
  leadId: string,
): Promise<ActionResult> {
  const user = await requireDbUser()
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' }

  if (!isScrapeAgentConfigured()) {
    return {
      ok: false,
      error:
        'Scrape agent not configured. Set SCRAPE_AGENT_URL and run agents/python/scrape-agent.',
    }
  }

  const lead = await prismaClient.huntedLead.findFirst({
    where: { id: leadId, userId: user.id },
  })
  if (!lead) return { ok: false, error: 'Lead not found' }

  const website = lead.website?.trim()
  if (!website) {
    return {
      ok: false,
      error: 'This lead has no website URL to scrape.',
    }
  }

  const geminiApiKey = await resolveGeminiApiKey(user.id)
  const scraped = await enrichWebsiteViaScrapeAgent({
    url: website,
    leadId: lead.id,
    userId: user.id,
    name: lead.name,
    company: lead.businessName,
    geminiApiKey,
  })

  if (!scraped.ok) {
    return { ok: false, error: scraped.error }
  }

  const snapshot = toLeadWebsiteScrape(scraped.data)
  await prismaClient.huntedLead.update({
    where: { id: lead.id },
    data: {
      websiteScrapeJson: snapshot as unknown as Prisma.InputJsonValue,
    },
  })

  revalidatePath('/lead')
  revalidatePath(`/lead/${lead.id}`)
  return { ok: true }
}

export async function getHuntedLeadProfile(leadId: string) {
  const user = await requireDbUser()
  if (!user) return null

  const lead = await prismaClient.huntedLead.findFirst({
    where: { id: leadId, userId: user.id },
  })
  if (!lead) return null

  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    website: lead.website,
    address: lead.address,
    businessName: lead.businessName,
    source: lead.source,
    score: lead.score,
    scoreReason: lead.scoreReason,
    niche: lead.niche,
    location: lead.location,
    websiteScrape: lead.websiteScrapeJson,
    createdAt: lead.createdAt.toISOString(),
    scrapeAgentReady: isScrapeAgentConfigured(),
  }
}
