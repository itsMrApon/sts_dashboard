import 'server-only'
import { createHash } from 'node:crypto'
import { resolveUserProviderKey } from '@/lib/credentials/providerKeys'
import { prismaClient } from '@/lib/prismaClient'
import { recordProviderUsageLater } from '@/lib/usage/providerUsage'
import { synthesizeWithCartesia } from '@/lib/voices/cartesiaSpeech'
import { resolveWizardVoice, spokenText, type VoiceWizardStep } from '@/lib/wizard/types'

/** The voice resolves first, so clips made with a retired Deepgram voice are re-made on Cartesia. */
export function clipHash(voice: string, step: Pick<VoiceWizardStep, 'narration' | 'heading' | 'body'>): string {
  return createHash('sha256').update(`${resolveWizardVoice(voice)}\n${spokenText(step)}`).digest('hex')
}

/** Short version string for cache-busting public audio URLs. */
export function clipVersion(voice: string, step: VoiceWizardStep): string {
  return clipHash(voice, step).slice(0, 16)
}

export class TtsUnavailableError extends Error {}

/** Narration runs on the wizard owner's own Cartesia key (AI Agents → Config), never the platform's. */
async function synthesizeNarration(text: string, voice: string, apiKey: string | null): Promise<Uint8Array> {
  if (!apiKey) throw new TtsUnavailableError('Wizard owner has no Cartesia API key')
  return synthesizeWithCartesia({ text, voiceId: resolveWizardVoice(voice), apiKey })
}

export async function getCachedClip(input: { wizardId: string; voice: string; step: VoiceWizardStep }) {
  return prismaClient.voiceWizardClip.findUnique({
    where: { wizardId_textHash: { wizardId: input.wizardId, textHash: clipHash(input.voice, input.step) } },
    select: { audio: true, mimeType: true },
  })
}

/** Returns the cached clip or synthesizes + stores it. */
export async function getOrCreateClip(input: {
  wizardId: string
  voice: string
  step: VoiceWizardStep
  /** Wizard owner — TTS runs on (and is attributed to) their key. */
  ownerUserId: string
  /** Owner's Cartesia key when the caller already has it (saves a DB read per clip). */
  cartesiaApiKey?: string | null
}): Promise<{ audio: Uint8Array; mimeType: string; created: boolean }> {
  const textHash = clipHash(input.voice, input.step)
  const cached = await getCachedClip(input)
  if (cached) return { ...cached, created: false }

  const text = spokenText(input.step)
  const apiKey =
    input.cartesiaApiKey !== undefined
      ? input.cartesiaApiKey
      : await resolveUserProviderKey(input.ownerUserId, 'cartesia')
  const audio = await synthesizeNarration(text, input.voice, apiKey)
  recordProviderUsageLater({
    userId: input.ownerUserId,
    provider: 'cartesia',
    kind: 'tts',
    surface: 'wizard',
    requestCount: 1,
    inputUnits: text.length,
    outputUnits: audio.byteLength,
  })
  await prismaClient.voiceWizardClip.upsert({
    where: { wizardId_textHash: { wizardId: input.wizardId, textHash } },
    create: { wizardId: input.wizardId, textHash, audio, mimeType: 'audio/mpeg' },
    update: {},
  })
  return { audio, mimeType: 'audio/mpeg', created: true }
}

/** Removes clips no longer referenced by the current steps/voice. */
export async function pruneStaleClips(wizardId: string, voice: string, steps: VoiceWizardStep[]) {
  const keep = steps.map((step) => clipHash(voice, step))
  await prismaClient.voiceWizardClip.deleteMany({
    where: { wizardId, textHash: { notIn: keep } },
  })
}

/** Pre-renders every step (3 at a time) so the first visitor gets instant audio. */
export async function pregenerateClips(
  wizardId: string,
  ownerUserId: string,
  voice: string,
  steps: VoiceWizardStep[],
) {
  const cartesiaApiKey = await resolveUserProviderKey(ownerUserId, 'cartesia')
  if (!cartesiaApiKey) return { failed: steps.length, missingKey: true }

  let failed = 0
  const queue = [...steps]
  const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
    for (let step = queue.shift(); step; step = queue.shift()) {
      try {
        await getOrCreateClip({ wizardId, voice, step, ownerUserId, cartesiaApiKey })
      } catch (error) {
        failed += 1
        console.warn('[wizard] clip generation failed', step.id, error)
      }
    }
  })
  await Promise.all(workers)
  return { failed, missingKey: false }
}
