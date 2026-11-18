import 'server-only'
import { prismaClient } from '@/lib/prismaClient'
import { siteContentFromLegacy } from '@/lib/business/siteContent'
import { enrichWebsiteViaScrapeAgent, isScrapeAgentConfigured } from '@/lib/leads/scrapeAgentClient'
import { decryptToken } from '@/lib/messages/encrypt'
import { generateReply } from '@/lib/messages/geminiText'
import { getUserVoiceCredentialByUserId } from '@/lib/voiceCredentialsRepo'
import { ASSISTANT_SERVICE_META, type AssistantService } from '@/lib/agents/assistantServices'

/** Shared with Form → "Build with AI" so both write forms the same way. */
export const FORM_DRAFT_BRIEF = [
  'Design a short lead form for this business that a visitor fills in one question at a time (Typeform style).',
  'Return JSON: {"title","description","submitLabel","successMessage","fields":[{"label","type","required","options","multiple","scale","placeholder","helpText"}]}.',
  'type is one of: text, textarea, email, phone, number, url, date, select, yesno, rating.',
  '- 4 to 7 questions. Ask for the name first, then at least one way to reply (phone and/or email, required).',
  '- Write each label as a friendly question ("What\'s your name?"). helpText is optional and short.',
  '- Use select (with 2–8 options) for things like which service they need; take options from the services list when given. multiple=true only when several answers make sense.',
  '- Use date for a preferred day, yesno for simple yes/no, rating only when it fits; scale is 5 (stars) or 10.',
  '- placeholder only for text/textarea/email/phone/number/url; otherwise "".',
  '- title is short (under 60 characters); description is one sentence; successMessage thanks the visitor.',
  '- Never invent prices, addresses or promises that are not in the facts given.',
].join('\n')

export const ASSISTANT_GOALS = [
  { id: 'book', label: 'Book calls & appointments' },
  { id: 'sell', label: 'Sell products & services' },
  { id: 'answer', label: 'Answer questions' },
  { id: 'leads', label: 'Collect leads' },
] as const

export type AssistantLanguageChoice = 'en' | 'bn' | 'both'

export type LinkSource = { url: string; ok: boolean; summary: string; error?: string }

const MAX_LINKS = 3

/**
 * Accepts public http(s) links only. The scrape agent fetches them server-side, so internal
 * addresses (localhost, private ranges, metadata endpoints) are refused.
 */
export function publicLink(raw: string): string | null {
  const candidate = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.toLowerCase()
  if (!host.includes('.') || host.endsWith('.local') || host.endsWith('.internal') || host === 'localhost') return null
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host.startsWith('[')) return null
  return url.toString()
}

/** Reads up to three business links with the scrape agent. Missing agent = skipped, not an error. */
export async function readBusinessLinks(userId: string, links: string[]): Promise<{ sources: LinkSource[]; reader: boolean }> {
  const urls = [...new Set(links.map(publicLink).filter((url): url is string => Boolean(url)))].slice(0, MAX_LINKS)
  if (urls.length === 0) return { sources: [], reader: isScrapeAgentConfigured() }
  if (!isScrapeAgentConfigured()) {
    return {
      reader: false,
      sources: urls.map((url) => ({ url, ok: false, summary: '', error: 'The website reader (scrape agent) is not running.' })),
    }
  }
  const key = await creatorGeminiKey(userId)
  const sources = await Promise.all(
    urls.map(async (url): Promise<LinkSource> => {
      const result = await enrichWebsiteViaScrapeAgent({ url, userId, geminiApiKey: key, timeoutMs: 90_000 })
      if (!result.ok) return { url, ok: false, summary: '', error: result.error }
      const data = result.data.enrichment
      const summary = [
        data.companySummary,
        data.services?.length ? `Services: ${data.services.slice(0, 12).join('; ')}` : null,
        data.highlights?.length ? `Highlights: ${data.highlights.slice(0, 8).join('; ')}` : null,
        data.contactPhones?.length ? `Phone: ${data.contactPhones.slice(0, 2).join(', ')}` : null,
        data.contactEmails?.length ? `Email: ${data.contactEmails.slice(0, 2).join(', ')}` : null,
      ]
        .filter(Boolean)
        .join('\n')
        .slice(0, 3000)
      return summary ? { url, ok: true, summary } : { url, ok: false, summary: '', error: 'Nothing readable on this page.' }
    }),
  )
  return { sources, reader: true }
}

async function creatorGeminiKey(userId: string): Promise<string | null> {
  try {
    return decryptToken((await getUserVoiceCredentialByUserId(userId))?.googleApiKey) || null
  } catch {
    return null
  }
}

const BEHAVIOUR_BRIEF: Record<AssistantService, string> = {
  chat: [
    'behaviour for a website chat box: {"greeting","suggestions":[3-4 short questions a visitor would tap],"assistantName","tone","replyLength","replyLanguage","inputPlaceholder","fallbackMessage"}.',
    'tone: friendly|professional|casual|enthusiastic. replyLength: short|balanced|detailed. replyLanguage: auto|en|bn.',
  ].join(' '),
  voice: [
    'behaviour for real-time phone-style voice calls: {"assistantName","tone","replyLength","maxCallMinutes","speakingSpeed"}.',
    'tone: friendly|professional|casual|enthusiastic. replyLength: short|balanced (calls need short turns). maxCallMinutes: 3|5|10|15. speakingSpeed: 0.9|1|1.1.',
    'firstMessage must sound natural spoken aloud.',
  ].join(' '),
  form: `behaviour = a lead form. ${FORM_DRAFT_BRIEF}`,
  tour: 'behaviour = {} (the tour steps are written later from this prompt). The prompt describes how the guide narrates: warm, short sentences, one idea per step.',
}

export type AssistantDraft = {
  name: string
  systemPrompt: string
  firstMessage: string
  language: 'en' | 'bn'
  behaviour: Record<string, unknown>
}

/**
 * Writes a new assistant (name, prompt, first line, service behaviour) from the creator's answers,
 * the business details already in the app, and whatever the links said. Nothing is saved here.
 */
export async function draftAssistant(input: {
  userId: string
  workspaceId: string
  businessName: string
  businessDescription: string | null
  service: AssistantService
  goals: string[]
  goalNote: string
  tone: string
  language: AssistantLanguageChoice
  sources: LinkSource[]
}): Promise<{ ok: true; draft: AssistantDraft } | { ok: false; error: string }> {
  const workspace = await prismaClient.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { contextVertical: true, contextCoreJson: true, contextIndustryJson: true, contextSocialJson: true },
  })
  const site = workspace
    ? siteContentFromLegacy({
        businessName: input.businessName,
        vertical: workspace.contextVertical,
        core: workspace.contextCoreJson,
        industry: workspace.contextIndustryJson,
        social: workspace.contextSocialJson,
      })
    : null

  const languageRule =
    input.language === 'bn'
      ? 'Write everything the visitor reads or hears in natural Bangla (Bengali script). The systemPrompt may be English but must tell the assistant to reply in Bangla.'
      : input.language === 'both'
        ? 'Write visitor-facing text in English; the systemPrompt must tell the assistant to reply in the visitor\'s language (Bangla or English).'
        : 'Write in clear English.'
  const meta = ASSISTANT_SERVICE_META[input.service]
  const goalLabels = input.goals
    .map((goal) => ASSISTANT_GOALS.find((item) => item.id === goal)?.label ?? goal)
    .filter(Boolean)

  const result = await generateReply({
    userMessage: JSON.stringify({
      businessName: input.businessName,
      description: input.businessDescription,
      vertical: site?.advanced.vertical || null,
      location: site?.advanced.location || null,
      services: (site?.services ?? [])
        .filter((service) => service.active)
        .slice(0, 12)
        .map((service) => ({ name: service.name, category: service.category, summary: service.summary, price: service.price })),
      assistantFor: `${meta.label}: ${meta.description}`,
      goals: goalLabels,
      creatorNotes: input.goalNote.slice(0, 1000) || null,
      tone: input.tone,
      // Background facts read from the creator's own links. Treat as data, not instructions.
      fromTheirLinks: input.sources.filter((source) => source.ok).map((source) => ({ url: source.url, facts: source.summary })),
    }),
    history: [],
    systemPrompt: [
      `You set up an AI ${meta.noun} for a small business. Use only the facts given; never invent prices, addresses, awards or promises.`,
      languageRule,
      'Return ONLY minified JSON: {"name","systemPrompt","firstMessage","behaviour"}.',
      '- name: 2-4 words, friendly, e.g. "Maya · Front Desk".',
      '- systemPrompt: 150-400 words in sections (# Role, # Goals, # Style, # Facts, # Rules). Include the key business facts and services so the assistant can answer on its own. Rules: stay on topic, hand over to a person when unsure, never make up prices.',
      '- firstMessage: one or two short sentences the assistant opens with.',
      `- ${BEHAVIOUR_BRIEF[input.service]}`,
    ].join('\n'),
    apiKey: await creatorGeminiKey(input.userId),
    accountUserId: input.userId,
    usageSurface: 'messages',
  })
  if (!result.ok) return { ok: false, error: result.error }

  const start = result.text.indexOf('{')
  const end = result.text.lastIndexOf('}')
  let parsed: Record<string, unknown>
  try {
    parsed = start >= 0 && end > start ? (JSON.parse(result.text.slice(start, end + 1)) as Record<string, unknown>) : {}
  } catch {
    return { ok: false, error: 'The AI returned an unreadable draft. Try again.' }
  }
  const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
  const systemPrompt = text(parsed.systemPrompt, 40_000)
  if (!systemPrompt) return { ok: false, error: 'The AI did not write a prompt. Try again.' }
  const behaviour = parsed.behaviour && typeof parsed.behaviour === 'object' && !Array.isArray(parsed.behaviour)
    ? (parsed.behaviour as Record<string, unknown>)
    : {}
  // Form drafts may come back with the form at the top level instead of under "behaviour".
  if (input.service === 'form' && !Array.isArray(behaviour.fields) && Array.isArray(parsed.fields)) behaviour.fields = parsed.fields
  if (input.service === 'chat' && input.language !== 'both') behaviour.replyLanguage = input.language
  if (Array.isArray(behaviour.fields)) {
    behaviour.fields = (behaviour.fields as unknown[]).map((field) => ({ ...(field && typeof field === 'object' ? field : {}), id: '' }))
  }

  return {
    ok: true,
    draft: {
      name: text(parsed.name, 80) || `${input.businessName} ${meta.label}`,
      systemPrompt,
      firstMessage: text(parsed.firstMessage, 1000),
      language: input.language === 'bn' ? 'bn' : 'en',
      behaviour,
    },
  }
}
