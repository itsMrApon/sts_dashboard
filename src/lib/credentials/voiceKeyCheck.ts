import 'server-only'
import { auth } from '@clerk/nextjs/server'
import type { AgentEngine } from '@/lib/agents/engineOptions'
import { resolveAgentEngine } from '@/lib/agents/engineSettings'
import { missingKeysMessage, savedKeyFor } from '@/lib/credentials/providerKeys'
import { resolveRoomOwnerUserId } from '@/lib/messages/resolveRoomOwnerUserId'
import { parseOfferRoomName } from '@/lib/offers/offerAi'
import { prismaClient } from '@/lib/prismaClient'
import {
  getUserVoiceCredentialByUserId,
  type VoiceCredentialProvider,
} from '@/lib/voiceCredentialsRepo'

/** Shown to buyers/visitors: they can't fix a creator's keys, so no provider details. */
export const VOICE_UNAVAILABLE_FOR_VISITOR = "Voice isn't available right now. Please try chat instead."

export type VoiceKeyCheck =
  | { ok: true }
  | { ok: false; missing: VoiceCredentialProvider[]; ownerUserId: string | null }

/**
 * Agent room behind any LiveKit room name (same rules as the agent-config route):
 *   <agentRoom>__offer__<slug>__<id>, <agentRoom>__voice__<id>, <agentRoom>-v<n>
 */
export function baseAgentRoomName(roomName: string): string {
  const offerRoom = parseOfferRoomName(roomName)
  if (offerRoom) return offerRoom.baseRoomName
  // Phone calls: <agentRoom>__phone___<caller>_<random> (LiveKit SIP dispatch rule).
  return roomName.split('__phone__')[0].split('__voice__')[0].replace(/-v\d+$/u, '')
}

/** Keys a call on this engine needs. Mirrors agents/python/livekit-agent/agent/pipeline.py. */
export function providersForEngine(
  engine: AgentEngine,
  language?: string | null,
): VoiceCredentialProvider[] {
  if (engine.mode === 'realtime') return [engine.realtimeProvider]
  // Grok STT has no Bangla; the worker swaps in Deepgram for Bangla rooms.
  const isBangla = (language || '').toLowerCase().startsWith('bn')
  const stt: VoiceCredentialProvider = engine.sttProvider === 'xai' && isBangla ? 'deepgram' : engine.sttProvider
  return Array.from(new Set<VoiceCredentialProvider>([stt, engine.llmProvider, engine.voiceProvider]))
}

/**
 * Checks the room owner has saved every key their voice engine needs, before a LiveKit room
 * is created. Rooms without a LiveKit agent are not gated here.
 */
export async function checkVoiceKeysForRoom(roomName: string): Promise<VoiceKeyCheck> {
  const baseRoomName = baseAgentRoomName(roomName)
  const agent = await prismaClient.liveKitAgent.findFirst({
    where: { roomName: baseRoomName },
    select: {
      id: true,
      language: true,
      llmProvider: true,
      llmModel: true,
      voiceProvider: true,
      voiceModel: true,
    },
  })
  if (!agent) return { ok: true }

  const ownerUserId = await resolveRoomOwnerUserId(agent.id, baseRoomName)
  const [engine, credentialRow] = await Promise.all([
    resolveAgentEngine(agent, ownerUserId),
    ownerUserId ? getUserVoiceCredentialByUserId(ownerUserId) : Promise.resolve(null),
  ])
  const missing = providersForEngine(engine, agent.language).filter(
    (provider) => !savedKeyFor(credentialRow, provider),
  )
  return missing.length > 0 ? { ok: false, missing, ownerUserId } : { ok: true }
}

async function viewerIsUser(userId: string | null): Promise<boolean> {
  if (!userId) return false
  const { userId: clerkId } = await auth()
  if (!clerkId) return false
  const viewer = await prismaClient.user.findUnique({ where: { clerkId }, select: { id: true } })
  return viewer?.id === userId
}

/** The owner sees which keys to add; anyone else gets a neutral message. */
export async function voiceKeyErrorMessage(
  check: Extract<VoiceKeyCheck, { ok: false }>,
): Promise<string> {
  return (await viewerIsUser(check.ownerUserId))
    ? missingKeysMessage(check.missing)
    : VOICE_UNAVAILABLE_FOR_VISITOR
}
