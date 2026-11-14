import 'server-only'
import { createHash } from 'node:crypto'
import { resolveUserProviderKey } from '@/lib/credentials/providerKeys'
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

/** Narration runs on the wizard owner's own Deepgram key (AI Agents → Config), never the platform's. */
async function synthesizeWithDeepgram(text: string, voice: string, apiKey: string | null): Promise<Uint8Array> {
  if (!apiKey) throw new TtsUnavailableError('Wizard owner has no Deepgram API key')

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
  /** Wizard owner — TTS runs on (and is attributed to) their key. */
  ownerUserId: string
  /** Owner's Deepgram key when the caller already has it (saves a DB read per clip). */
  deepgramApiKey?: string | null
}): Promise<{ audio: Uint8Array; mimeType: string; created: boolean }> {
  const textHash = clipHash(input.voice, input.step)
  const cached = await getCachedClip(input)
  if (cached) return { ...cached, created: false }

  const text = spokenText(input.step)
  const apiKey =
    input.deepgramApiKey !== undefined
      ? input.deepgramApiKey
      : await resolveUserProviderKey(input.ownerUserId, 'deepgram')
  const audio = await synthesizeWithDeepgram(text, input.voice, apiKey)
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
  const deepgramApiKey = await resolveUserProviderKey(ownerUserId, 'deepgram')
  if (!deepgramApiKey) return { failed: steps.length, missingKey: true }

  let failed = 0
  const queue = [...steps]
  const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
    for (let step = queue.shift(); step; step = queue.shift()) {
      try {
        await getOrCreateClip({ wizardId, voice, step, ownerUserId, deepgramApiKey })
      } catch (error) {
        failed += 1
        console.warn('[wizard] clip generation failed', step.id, error)
      }
    }
  })
  await Promise.all(workers)
  return { failed, missingKey: false }
}
