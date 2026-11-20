import 'server-only'
import { RoomAgentDispatch, RoomConfiguration, SipClient } from 'livekit-server-sdk'

/**
 * LiveKit's side of a phone line: an inbound trunk for the number and a dispatch rule that puts
 * each caller in their own room, `<businessRoom>__phone___<caller>_<random>`, with the voice worker
 * (agent "saas-agent") dispatched into it. The agent-config route reads the business room from
 * that name.
 */

export const PHONE_ROOM_SEPARATOR = '__phone__'
const VOICE_AGENT_NAME = 'saas-agent'

/** The project's SIP address from LiveKit (Settings → SIP URI), without the "sip:" part. */
export function livekitSipHost(): string | null {
  const value = (process.env.LIVEKIT_SIP_URI || '').trim().replace(/^sips?:/i, '')
  return value || null
}

function sipClient() {
  const url = process.env.LIVEKIT_URL
  const key = process.env.LIVEKIT_API_KEY
  const secret = process.env.LIVEKIT_API_SECRET
  if (!url || !key || !secret) throw new Error('Missing LIVEKIT_URL, LIVEKIT_API_KEY, or LIVEKIT_API_SECRET')
  return new SipClient(url.replace(/^wss?:/, 'https:'), key, secret)
}

export async function createPhoneRouting(input: {
  phoneNumber: string
  roomName: string
  label: string
}): Promise<{ ok: true; trunkId: string; ruleId: string } | { ok: false; error: string }> {
  const client = sipClient()
  let trunkId: string | null = null
  try {
    const trunk = await client.createSipInboundTrunk(`${input.label} ${input.phoneNumber}`.slice(0, 120), [input.phoneNumber], {
      krispEnabled: true,
    })
    trunkId = trunk.sipTrunkId
    const rule = await client.createSipDispatchRule(
      { type: 'individual', roomPrefix: `${input.roomName}${PHONE_ROOM_SEPARATOR}` },
      {
        name: `${input.label} phone`.slice(0, 120),
        trunkIds: [trunkId],
        roomConfig: new RoomConfiguration({ agents: [new RoomAgentDispatch({ agentName: VOICE_AGENT_NAME })] }),
      },
    )
    return { ok: true, trunkId, ruleId: rule.sipDispatchRuleId }
  } catch (error) {
    if (trunkId) await client.deleteSipTrunk(trunkId).catch(() => null)
    const message = error instanceof Error ? error.message : 'LiveKit error'
    return { ok: false, error: `LiveKit could not set up the number: ${message}` }
  }
}

export async function deletePhoneRouting(input: { trunkId: string | null; ruleId: string | null }) {
  const client = sipClient()
  if (input.ruleId) await client.deleteSipDispatchRule(input.ruleId).catch(() => null)
  if (input.trunkId) await client.deleteSipTrunk(input.trunkId).catch(() => null)
}
