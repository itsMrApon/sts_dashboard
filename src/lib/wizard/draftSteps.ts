import 'server-only'
import { prismaClient } from '@/lib/prismaClient'
import { generateReply } from '@/lib/messages/geminiText'
import { getUserVoiceCredentialByUserId } from '@/lib/voiceCredentialsRepo'
import { decryptToken } from '@/lib/messages/encrypt'
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
}): Promise<{ steps: VoiceWizardStep[]; source: 'ai' | 'template'; note?: string }> {
  const facts = await loadBusinessFacts({ workspaceId: input.workspaceId, fallbackName: input.wizardName })
  const fallback = templateSteps(facts, input.guideName, input.language)

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

  const systemPrompt = [
    `You write scripts for "${input.guideName}", a voice guide that walks visitors through a small-business website section by section.`,
    languageRule,
    'Return ONLY a JSON array of 4 to 7 objects with keys: heading (max 60 chars), body (1-2 sentences shown on screen), narration (what the guide says aloud, 1-3 short conversational sentences, max 300 chars), ctaLabel (optional), ctaUrl (optional).',
    'The first step greets the visitor and introduces the guide by name. The last step invites them to talk to the business.',
    'Use only facts provided. Never invent prices, awards or statistics.',
  ].join('\n')

  const userMessage = JSON.stringify({
    businessName: facts.businessName,
    pitch: facts.pitch,
    description: facts.description,
    offerings: facts.offerings,
    profile: facts.profileSummary,
    contactUrl: facts.chatUrl,
  })

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

  const lastStep = steps[steps.length - 1]
  if (facts.chatUrl && !lastStep.ctaUrl) {
    lastStep.ctaUrl = facts.chatUrl
    lastStep.ctaLabel ||= input.language === 'bn' ? 'কথা বলুন' : 'Talk to us'
  }
  return { steps, source: 'ai' }
}
