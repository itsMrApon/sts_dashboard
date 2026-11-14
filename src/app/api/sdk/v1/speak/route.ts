import { randomBytes } from 'node:crypto'
import { EMBED_DAILY_QUOTAS, EMBED_RATE_LIMITS } from '@/lib/embed/rateLimit'
import { getLiveKitConnectionDetails } from '@/lib/livekit/livekitVoiceAgent'
import { getBusinessServices } from '@/lib/services/serviceConfig'
import { guardSdkRequest, sdkJson, sdkOptions, serviceDisabled } from '@/lib/sdk/sdkGuard'
import { checkVoiceKeysForRoom, VOICE_UNAVAILABLE_FOR_VISITOR } from '@/lib/credentials/voiceKeyCheck'

export async function OPTIONS(request: Request) {
  return sdkOptions(request)
}

/** LiveKit join token for a fresh call room; the voice worker reads the business AI by room name. */
export async function POST(request: Request) {
  const guard = await guardSdkRequest(request, {
    scope: 'voice',
    perSession: EMBED_RATE_LIMITS.voice,
    perIp: EMBED_RATE_LIMITS.voiceIp,
    dailyQuota: EMBED_DAILY_QUOTAS.voice,
  })
  if (!guard.ok) return guard.response

  const { speak } = await getBusinessServices(guard.business.workspaceId)
  if (!speak.enabled) return serviceDisabled(guard.corsHeaders, 'Speak AI')

  // Creators run voice on their own keys; website visitors get a neutral message.
  const keys = await checkVoiceKeysForRoom(guard.business.roomName)
  if (!keys.ok) {
    return sdkJson({ error: VOICE_UNAVAILABLE_FOR_VISITOR, code: 'MISSING_PROVIDER_KEY' }, guard.corsHeaders, { status: 409 })
  }

  const body = (await request.json().catch(() => null)) as { participantName?: unknown } | null
  const participantName =
    typeof body?.participantName === 'string' && body.participantName.trim()
      ? body.participantName.trim().slice(0, 100)
      : 'Website visitor'

  try {
    const details = await getLiveKitConnectionDetails({
      roomName: `${guard.business.roomName}-v${Date.now()}`,
      participantName,
      participantIdentity: `web_${guard.claims.sid}_${randomBytes(3).toString('hex')}`,
    })
    return sdkJson({ ...details, maxCallMinutes: speak.config.maxCallMinutes }, guard.corsHeaders)
  } catch (error) {
    console.error('[sdk-speak]', error)
    return sdkJson({ error: 'Could not start the call', code: 'SPEAK_FAILED' }, guard.corsHeaders, { status: 500 })
  }
}
