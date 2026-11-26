import 'server-only'
import { prismaClient } from '@/lib/prismaClient'
import { decryptToken } from '@/lib/messages/encrypt'
import { generateReply } from '@/lib/messages/geminiText'
import { getUserVoiceCredentialByUserId } from '@/lib/voiceCredentialsRepo'
import { isDeliverableEmail } from '@/lib/email/sendEmail'
import { loadBusinessBrain } from '@/lib/mcp/businessBrain'
import { submitWriteRequest } from '@/lib/agentBridge/bridge'
import { findAgentTool } from '@/lib/agentBridge/registry'

/**
 * Lead matches: the AI reads the creator's open leads next to what the business sells and picks
 * the leads that clearly need one of the offers. Each strong fit becomes a "Lead match" card in
 * Lead → Approval with the reason and a first email. Allowing it puts the email as a draft in
 * Messages; nothing is sent until the creator clicks Send.
 */

const LEADS_PER_RUN = 25
const MIN_FIT = 60
const RECENT_MATCH_DAYS = 30

type Match = { leadId: string; offer: string; fit: number; why: string; subject: string; body: string }

function parseMatches(text: string): Match[] {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '')
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start < 0 || end <= start) return []
  try {
    const rows = JSON.parse(cleaned.slice(start, end + 1)) as unknown[]
    return rows
      .map((row) => row as Partial<Record<keyof Match, unknown>>)
      .filter((r) => typeof r.leadId === 'string' && typeof r.offer === 'string' && typeof r.body === 'string')
      .map((r) => ({
        leadId: String(r.leadId),
        offer: String(r.offer).slice(0, 200),
        fit: Number(r.fit) || 0,
        why: String(r.why ?? '').slice(0, 500),
        subject: String(r.subject ?? 'Hello').slice(0, 200),
        body: String(r.body).slice(0, 10_000),
      }))
  } catch {
    return []
  }
}

/** Leads already matched recently (pending, allowed or denied): don't suggest them again. */
async function recentlyMatchedLeadIds(userId: string) {
  const requests = await prismaClient.agentRequest.findMany({
    where: { userId, tool: 'propose_lead_match', createdAt: { gte: new Date(Date.now() - RECENT_MATCH_DAYS * 86_400_000) } },
    select: { input: true },
  })
  return new Set(requests.map((r) => (r.input as { payload?: { leadId?: string } } | null)?.payload?.leadId).filter(Boolean))
}

export async function findLeadMatches(userId: string): Promise<{ looked: number; matched: number }> {
  const cred = await getUserVoiceCredentialByUserId(userId)
  let apiKey: string | null = null
  try {
    apiKey = decryptToken(cred?.googleApiKey) || null
  } catch {
    apiKey = null
  }
  if (!apiKey) throw new Error('Add your Gemini API key in Settings to find matches.')
  const brain = await loadBusinessBrain(userId)
  if (!brain) throw new Error('Set up your business first.')

  const skip = await recentlyMatchedLeadIds(userId)
  const leads = (
    await prismaClient.callIntelLead.findMany({
      where: { userId, outboundStatus: { in: ['NEW', 'ON_PROCESS'] } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: { id: true, name: true, company: true, position: true, email: true, mapsCategory: true, website: true, notes: true, webResearchJson: true },
    })
  )
    .filter((l) => isDeliverableEmail(l.email) && !skip.has(l.id))
    .slice(0, LEADS_PER_RUN)
  if (leads.length === 0) return { looked: 0, matched: 0 }

  const offers = brain.offers.length ? brain.offers.map((o) => `- ${o.name} (${o.url})`).join('\n') : '(no live offers: use the services in the business knowledge)'
  const leadLines = leads
    .map((l) =>
      JSON.stringify({
        leadId: l.id,
        name: l.name,
        company: l.company,
        position: l.position,
        type: l.mapsCategory,
        website: l.website,
        notes: l.notes?.slice(0, 300),
        research: l.webResearchJson ? JSON.stringify(l.webResearchJson).slice(0, 600) : undefined,
      }),
    )
    .join('\n')

  const systemPrompt = [
    `You match leads to what the business "${brain.name}" sells. Be strict: only a clear, specific need counts.`,
    brain.description ? `About the business: ${brain.description}` : null,
    `What it sells:\n${offers}`,
    `Business knowledge:\n${brain.knowledge.slice(0, 3000)}`,
    `Return only a JSON array. One item per lead that clearly needs something it sells (fit ${MIN_FIT}-100), nothing for the others:`,
    '[{"leadId":"...","offer":"exact offer or service name","fit":0-100,"why":"the evidence, one sentence","subject":"...","body":"short plain-text first email, specific to them, one clear ask, signed as the business"}]',
    'Never invent prices, discounts or facts. Write in English unless the lead’s details are in Bangla.',
  ]
    .filter(Boolean)
    .join('\n\n')

  const result = await generateReply({ userMessage: `Leads:\n${leadLines}`, history: [], systemPrompt, apiKey, accountUserId: userId, usageSurface: 'messages' })
  if (!result.ok) throw new Error(result.error)

  const tool = findAgentTool('propose_lead_match')
  if (!tool || tool.kind !== 'write') throw new Error('Lead matching is not available.')
  const known = new Set(leads.map((l) => l.id))
  const task = `Lead matches · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  let matched = 0
  for (const match of parseMatches(result.text)) {
    if (!known.has(match.leadId) || match.fit < MIN_FIT) continue
    try {
      await submitWriteRequest({ userId, tokenId: '', client: 'app' }, tool, {
        lead_id: match.leadId,
        offer: match.offer,
        reason_it_fits: match.why,
        subject: match.subject,
        body: match.body,
        task,
        why: `Fit ${Math.round(match.fit)}/100: ${match.why}`,
      })
      matched++
    } catch (error) {
      console.warn('[lead-matches] skipped a match', error instanceof Error ? error.message : error)
    }
  }
  return { looked: leads.length, matched }
}
