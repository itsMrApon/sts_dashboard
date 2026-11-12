import 'server-only'
import { createHash } from 'node:crypto'
import { prismaClient } from '@/lib/prismaClient'
import { recordProviderUsageLater } from '@/lib/usage/providerUsage'
import { spokenText, type VoiceWizardStep } from '@/lib/wizard/types'

const DEEPGRAM_SPEAK_URL = 'https://api.deepgram.com/v1/speak'
const TTS_TIMEOUT_MS = 20_000

export function clipHash(voice: string, step: Pick<VoiceWizardStep, 'narration' | 'heading' | 'body'>): string {
  return createHash('sha256').update(`${voice}\n${spokenText(step)}`).digest('hex')
}

/** Short version string for cache-busting public audio URLs. */
export function clipVersion(voice: string, step: VoiceWizardStep): string {
  return clipHash(voice, step).slice(0, 16)
}

export class TtsUnavailableError extends Error {}

async function synthesizeWithDeepgram(text: string, voice: string): Promise<Uint8Array> {
  const apiKey = process.env.DEEPGRAM_API_KEY?.trim()
  if (!apiKey) throw new TtsUnavailableError('DEEPGRAM_API_KEY is not configured')

  const url = `${DEEPGRAM_SPEAK_URL}?model=${encodeURIComponent(voice)}&encoding=mp3`
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Deepgram TTS failed (${response.status}): ${detail.slice(0, 200)}`)
  }
  return new Uint8Array(await response.arrayBuffer())
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
  /** Wizard owner — TTS usage is attributed to them. */
  ownerUserId: string
}): Promise<{ audio: Uint8Array; mimeType: string; created: boolean }> {
  const textHash = clipHash(input.voice, input.step)
  const cached = await getCachedClip(input)
  if (cached) return { ...cached, created: false }

  const text = spokenText(input.step)
  const audio = await synthesizeWithDeepgram(text, input.voice)
  recordProviderUsageLater({
    userId: input.ownerUserId,
    provider: 'deepgram',
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
  let failed = 0
  const queue = [...steps]
  const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
    for (let step = queue.shift(); step; step = queue.shift()) {
      try {
        await getOrCreateClip({ wizardId, voice, step, ownerUserId })
      } catch (error) {
        failed += 1
        console.warn('[wizard] clip generation failed', step.id, error)
      }
    }
  })
  await Promise.all(workers)
  return { failed }
}
