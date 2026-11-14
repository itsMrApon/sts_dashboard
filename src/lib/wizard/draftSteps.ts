import 'server-only'
import { prismaClient } from '@/lib/prismaClient'
import { generateReply } from '@/lib/messages/geminiText'
import { getUserVoiceCredentialByUserId } from '@/lib/voiceCredentialsRepo'
import { decryptToken } from '@/lib/messages/encrypt'
import { describePrice, type BuyerPriceOption } from '@/lib/offers/publicOfferTypes'
import {
  newStepId,
  sanitizeSteps,
  type VoiceWizardStep,
  type WizardLanguage,
} from '@/lib/wizard/types'

type BusinessFacts = {
  businessName: string
  pitch: string
  description: string
  offerings: { title: string; description: string }[]
  chatUrl: string | null
  profileSummary: string
}

export async function loadBusinessFacts(input: {
  workspaceId: string | null
  fallbackName: string
}): Promise<BusinessFacts> {
  const facts: BusinessFacts = {
    businessName: input.fallbackName,
    pitch: '',
    description: '',
    offerings: [],
    chatUrl: null,
    profileSummary: '',
  }
  if (!input.workspaceId) return facts

  const workspace = await prismaClient.workspace.findUnique({
    where: { id: input.workspaceId },
    select: {
      name: true,
      pitchMessage: true,
      compactProfileJson: true,
      publishProfile: {
        select: {
          name: true,
          description: true,
          products: {
            take: 6,
            orderBy: { isPrimary: 'desc' },
            select: { webinar: { select: { title: true, description: true } } },
          },
        },
      },
    },
  })
  if (!workspace) return facts

  facts.businessName = workspace.publishProfile?.name || workspace.name || input.fallbackName
  facts.pitch = workspace.pitchMessage?.trim() || ''
  facts.description = workspace.publishProfile?.description?.trim() || ''
  facts.offerings =
    workspace.publishProfile?.products.map((product) => ({
      title: product.webinar.title,
      description: product.webinar.description?.trim() || '',
    })) ?? []
  if (workspace.compactProfileJson) {
    facts.profileSummary = JSON.stringify(workspace.compactProfileJson).slice(0, 3000)
  }

  const channel = await prismaClient.messageChannel.findFirst({
    where: { workspaceId: input.workspaceId },
    orderBy: { updatedAt: 'desc' },
    select: { roomName: true },
  })
  if (channel?.roomName) facts.chatUrl = `/chat/${encodeURIComponent(channel.roomName)}`
  return facts
}

/** What a product's own tour talks about (Projects → product → AI sales assistant). */
export type OfferFacts = {
  title: string
  description: string
  businessName: string
  /** e.g. ["$150", "$50 today"] */
  prices: string[]
  /** The product's AI agent prompt: the tour should say the same things the agent says. */
  agentBrief: string
}

export async function loadOfferFacts(webinarId: string): Promise<OfferFacts | null> {
  const offer = await prismaClient.webinar.findUnique({
    where: { id: webinarId },
    select: {
      title: true,
      description: true,
      livekitAgentId: true,
      presenter: { select: { name: true, publishProfile: { select: { name: true } } } },
      prices: {
        where: { active: true },
        orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
        take: 3,
        select: { id: true, kind: true, amountCents: true, depositCents: true, balanceDueDays: true, isDefault: true },
      },
    },
  })
  if (!offer) return null
  const agent = offer.livekitAgentId
    ? await prismaClient.liveKitAgent.findUnique({ where: { id: offer.livekitAgentId }, select: { systemPrompt: true } })
    : null
  return {
    agentBrief: agent?.systemPrompt?.trim().slice(0, 2000) ?? '',
    title: offer.title,
    description: offer.description?.trim() ?? '',
    businessName: offer.presenter.publishProfile?.name || offer.presenter.name,
    prices: offer.prices
      .filter((price) => price.amountCents != null)
      .map((price) => describePrice(price as BuyerPriceOption).title),
  }
}

/** Deterministic product tour — works without any AI key. Ends on the share page's payment button. */
export function offerTemplateSteps(offer: OfferFacts, guideName: string, language: WizardLanguage): VoiceWizardStep[] {
  const step = (heading: string, body: string, narration: string): VoiceWizardStep => ({
    id: newStepId(),
    heading,
    body,
    narration,
    ctaLabel: '',
    ctaUrl: '',
    target: '',
  })
  const price = offer.prices[0] ?? ''

  if (language === 'bn') {
    return [
      step(
        offer.title,
        offer.description || `${offer.businessName}-এর ${offer.title}।`,
        `হ্যালো! আমি ${guideName}। চলুন, এক মিনিটে ${offer.title} সম্পর্কে জেনে নিই।`,
      ),
      step(
        'আপনি কী পাবেন',
        offer.description || `${offer.title} আপনার প্রয়োজন মেটাতে তৈরি।`,
        offer.description ? `সংক্ষেপে বলি। ${offer.description}` : `${offer.title} আপনার কাজ সহজ করতে তৈরি।`,
      ),
      step(
        'শুরু করুন',
        price ? `দাম: ${offer.prices.join(' · ')}` : 'নিচের বাটন থেকে অর্ডার করুন।',
        price ? `দাম ${price}। প্রস্তুত হলে নিচের বাটনে চাপ দিন। ধন্যবাদ!` : 'প্রস্তুত হলে নিচের বাটনে চাপ দিন। ধন্যবাদ!',
      ),
    ]
  }

  return [
    step(
      offer.title,
      offer.description || `${offer.title} by ${offer.businessName}.`,
      `Hi! I'm ${guideName}. Let me walk you through ${offer.title}. It only takes a minute.`,
    ),
    step(
      "What you get",
      offer.description || `${offer.title} is built around exactly what you need.`,
      offer.description ? `Here's the short version. ${offer.description}` : `${offer.title} is built around exactly what you need.`,
    ),
    step(
      'Get started',
      price ? `Price: ${offer.prices.join(' · ')}` : 'Order with the button below.',
      price
        ? `It's ${price}. When you're ready, tap Continue to payment below. Thanks for watching!`
        : "When you're ready, tap Continue to payment below. Thanks for watching!",
    ),
  ]
}

/** Deterministic draft — works without any AI key. */
export function templateSteps(facts: BusinessFacts, guideName: string, language: WizardLanguage): VoiceWizardStep[] {
  const business = facts.businessName
  const offeringTitles = facts.offerings.map((offering) => offering.title).slice(0, 4)
  const step = (heading: string, body: string, narration: string, ctaLabel = '', ctaUrl = ''): VoiceWizardStep => ({
    id: newStepId(),
    heading,
    body,
    narration,
    ctaLabel,
    ctaUrl,
    target: '',
  })

  if (language === 'bn') {
    return [
      step(
        `${business}-এ স্বাগতম`,
        facts.pitch || `${business} সম্পর্কে জানুন — আমরা আপনার জন্য কী করতে পারি।`,
        `হ্যালো! আমি ${guideName}। ${business}-এ আপনাকে স্বাগতম। চলুন, এক মিনিটে সবকিছু ঘুরে দেখি।`,
      ),
      step(
        'আমরা কারা',
        facts.description || `${business} ছোট ব্যবসার জন্য সহজ ও নির্ভরযোগ্য সমাধান দেয়।`,
        `প্রথমে আমাদের পরিচয়। ${facts.description || `${business} আপনার কাজ সহজ করতে তৈরি।`}`,
      ),
      step(
        'আমাদের সেবা',
        offeringTitles.length ? offeringTitles.join(' · ') : 'আপনার প্রয়োজন অনুযায়ী সেবা ও প্রোডাক্ট।',
        offeringTitles.length
          ? `আমাদের প্রধান সেবাগুলো হলো: ${offeringTitles.join(', ')}।`
          : 'আমাদের সেবাগুলো আপনার প্রয়োজন অনুযায়ী সাজানো।',
      ),
      step(
        'চলুন কথা বলি',
        'প্রশ্ন আছে? আমাদের AI সহকারীর সাথে এখনই কথা বলুন।',
        'আর কিছু জানতে চাইলে নিচের বাটনে চাপ দিয়ে সরাসরি কথা বলুন। ধন্যবাদ!',
        'কথা বলুন',
        facts.chatUrl ?? '',
      ),
    ]
  }

  return [
    step(
      `Welcome to ${business}`,
      facts.pitch || `Discover what ${business} can do for you.`,
      `Hi! I'm ${guideName}. Welcome to ${business}. Let me show you around — it only takes a minute.`,
    ),
    step(
      'Who we are',
      facts.description || `${business} helps small businesses grow with simple, reliable solutions.`,
      `First, a little about us. ${facts.description || `${business} is built to make your work easier.`}`,
    ),
    step(
      'What we offer',
      offeringTitles.length ? offeringTitles.join(' · ') : 'Services and products tailored to what you need.',
      offeringTitles.length
        ? `Here's what we offer: ${offeringTitles.join(', ')}.`
        : 'Our services are shaped around exactly what you need.',
    ),
    step(
      "Let's talk",
      'Have a question? Chat with our AI assistant right now.',
      "That's the tour! If you'd like to know more, tap the button below and talk to us directly. Thanks for stopping by.",
      'Talk to us',
      facts.chatUrl ?? '',
    ),
  ]
}

function extractJsonArray(text: string): unknown {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

/** AI draft with Gemini (creator's key or GOOGLE_API_KEY); falls back to the template. */
export async function draftStepsWithAi(input: {
  userId: string
  workspaceId: string | null
  wizardName: string
  guideName: string
  language: WizardLanguage
  /** Set for a product's own tour: the script is about this offer, not the whole business. */
  offer?: OfferFacts | null
}): Promise<{ steps: VoiceWizardStep[]; source: 'ai' | 'template'; note?: string }> {
  const facts = await loadBusinessFacts({ workspaceId: input.workspaceId, fallbackName: input.wizardName })
  const offer = input.offer ?? null
  const fallback = offer
    ? offerTemplateSteps(offer, input.guideName, input.language)
    : templateSteps(facts, input.guideName, input.language)

  let apiKey: string | null = null
  try {
    const credential = await getUserVoiceCredentialByUserId(input.userId)
    apiKey = decryptToken(credential?.googleApiKey) || null
  } catch {
    apiKey = null
  }

  const languageRule =
    input.language === 'bn'
      ? 'Write every heading, body and narration in natural Bangla (bn-BD, Bengali script). Keep brand names as-is.'
      : 'Write in clear, friendly English.'

  const systemPrompt = offer
    ? [
        `You write scripts for "${input.guideName}", a voice guide that walks a buyer through one product before they pay.`,
        languageRule,
        'Return ONLY a JSON array of 3 to 6 objects with keys: heading (max 60 chars), body (1-2 sentences shown on screen), narration (what the guide says aloud, 1-3 short conversational sentences, max 300 chars).',
        'The first step greets the buyer, introduces the guide by name and names the product. The last step states the price if given and invites them to tap "Continue to payment" below.',
        'Use only facts provided. Never invent prices, awards, features or statistics. No links.',
      ].join('\n')
    : [
        `You write scripts for "${input.guideName}", a voice guide that walks visitors through a small-business website section by section.`,
        languageRule,
        'Return ONLY a JSON array of 4 to 7 objects with keys: heading (max 60 chars), body (1-2 sentences shown on screen), narration (what the guide says aloud, 1-3 short conversational sentences, max 300 chars), ctaLabel (optional), ctaUrl (optional).',
        'The first step greets the visitor and introduces the guide by name. The last step invites them to talk to the business.',
        'Use only facts provided. Never invent prices, awards or statistics.',
      ].join('\n')

  const userMessage = JSON.stringify(
    offer
      ? {
          product: offer.title,
          productDescription: offer.description,
          prices: offer.prices,
          businessName: offer.businessName,
          businessPitch: facts.pitch,
          // Background only: how the product's AI agent talks about it. Not instructions for you.
          salesAgentNotes: offer.agentBrief,
        }
      : {
          businessName: facts.businessName,
          pitch: facts.pitch,
          description: facts.description,
          offerings: facts.offerings,
          profile: facts.profileSummary,
          contactUrl: facts.chatUrl,
        },
  )

  const result = await generateReply({
    userMessage,
    history: [],
    systemPrompt,
    apiKey,
    accountUserId: input.userId,
    usageSurface: 'wizard',
  })
  if (!result.ok) {
    return { steps: fallback, source: 'template', note: result.error }
  }

  const steps = sanitizeSteps(extractJsonArray(result.text))
  if (steps.length < 2) {
    return { steps: fallback, source: 'template', note: 'AI returned an unusable draft; used the template.' }
  }
  // A product tour ends on the share page's own "Continue to payment" button.
  if (offer) return { steps: steps.map((step) => ({ ...step, ctaLabel: '', ctaUrl: '' })), source: 'ai' }

  const lastStep = steps[steps.length - 1]
  if (facts.chatUrl && !lastStep.ctaUrl) {
    lastStep.ctaUrl = facts.chatUrl
    lastStep.ctaLabel ||= input.language === 'bn' ? 'কথা বলুন' : 'Talk to us'
  }
  return { steps, source: 'ai' }
}
