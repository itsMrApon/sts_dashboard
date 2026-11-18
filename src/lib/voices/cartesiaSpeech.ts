import 'server-only'
import { CARTESIA_API_VERSION } from '@/lib/credentials/providerKeys'

const CARTESIA_TTS_URL = 'https://api.cartesia.ai/tts/bytes'
/** sonic-2 / sonic-turbo are sunset; sonic-3 is the current low-latency model. */
export const CARTESIA_TTS_MODEL = 'sonic-3'
const TTS_TIMEOUT_MS = 20_000

export class CartesiaUnavailableError extends Error {}

/** One-shot MP3 synthesis on the creator's own Cartesia key (never the platform's). */
export async function synthesizeWithCartesia(input: {
  text: string
  voiceId: string
  apiKey: string | null
  language?: 'en' | 'bn'
}): Promise<Uint8Array> {
  if (!input.apiKey) throw new CartesiaUnavailableError('No Cartesia API key')

  const response = await fetch(CARTESIA_TTS_URL, {
    method: 'POST',
    headers: {
      'X-API-Key': input.apiKey,
      'Cartesia-Version': CARTESIA_API_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_id: CARTESIA_TTS_MODEL,
      transcript: input.text,
      voice: { mode: 'id', id: input.voiceId },
      language: input.language ?? 'en',
      output_format: { container: 'mp3', sample_rate: 44100, bit_rate: 128000 },
    }),
    signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Cartesia TTS failed (${response.status}): ${detail.slice(0, 200)}`)
  }
  return new Uint8Array(await response.arrayBuffer())
}
