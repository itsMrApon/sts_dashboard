'use server'

import { revalidatePath } from 'next/cache'
import { onAuthenticateUser } from '@/actions/auth'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'
import { checkVoiceKeysForRoom } from '@/lib/credentials/voiceKeyCheck'
import { decryptToken, encryptToken } from '@/lib/messages/encrypt'
import { createPhoneRouting, deletePhoneRouting, livekitSipHost } from '@/lib/phone/livekitSip'
import {
  createTwilioTrunkToLiveKit,
  deleteTwilioTrunk,
  listTwilioNumbers,
  TWILIO_SID_RE,
  TWILIO_TOKEN_RE,
  type TwilioAuth,
  type TwilioNumber,
} from '@/lib/phone/twilioApi'
import { prismaClient } from '@/lib/prismaClient'

/** Integrations → Phone: the creator's own Twilio number, answered by their Voice AI. */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

export type PhoneLineView = {
  phoneNumber: string
  /** False when the voice engine is missing a key, so calls would not be answered. */
  voiceReady: boolean
}

export type PhoneSetupStatus = {
  line: PhoneLineView | null
  /** LIVEKIT_SIP_URI is set, so numbers can be connected. */
  sipReady: boolean
}

async function requireBusiness() {
  const auth = await onAuthenticateUser()
  if (!auth.user) return null
  const business = await getCreatorBusiness(auth.user.id)
  return business ? { userId: auth.user.id, business } : null
}

function readAuth(input: { accountSid: string; authToken: string }): TwilioAuth | null {
  const accountSid = input.accountSid?.trim() ?? ''
  const authToken = input.authToken?.trim() ?? ''
  return TWILIO_SID_RE.test(accountSid) && TWILIO_TOKEN_RE.test(authToken) ? { accountSid, authToken } : null
}

const BAD_AUTH = 'Paste the Account SID (starts with AC) and Auth Token from the Twilio console home page.'

export async function getPhoneSetup(): Promise<PhoneSetupStatus> {
  const owner = await requireBusiness()
  const sipReady = Boolean(livekitSipHost())
  if (!owner) return { line: null, sipReady }
  const row = await prismaClient.phoneLine.findFirst({
    where: { workspaceId: owner.business.workspaceId, userId: owner.userId },
    select: { phoneNumber: true },
  })
  if (!row) return { line: null, sipReady }
  const keys = await checkVoiceKeysForRoom(owner.business.roomName)
  return { line: { phoneNumber: row.phoneNumber, voiceReady: keys.ok }, sipReady }
}

/** The account's voice numbers, so the creator can pick one. Nothing is saved yet. */
export async function listPhoneNumbers(input: {
  accountSid: string
  authToken: string
}): Promise<Result<{ numbers: TwilioNumber[] }>> {
  const auth = readAuth(input)
  if (!auth) return { ok: false, error: BAD_AUTH }
  if (!(await requireBusiness())) return { ok: false, error: 'Please sign in again' }
  const numbers = await listTwilioNumbers(auth)
  if (!numbers.ok) return numbers
  return { ok: true, numbers: numbers.result }
}

/**
 * Sends the number's calls to LiveKit: a Twilio SIP trunk pointing at the project's SIP address,
 * and on LiveKit an inbound trunk plus a rule that gives each caller a room with the Voice AI.
 * Anything half made is undone when a later step fails.
 */
export async function connectPhoneLine(input: {
  accountSid: string
  authToken: string
  numberSid: string
}): Promise<Result<{ status: PhoneSetupStatus }>> {
  const auth = readAuth(input)
  if (!auth) return { ok: false, error: BAD_AUTH }
  const owner = await requireBusiness()
  if (!owner) return { ok: false, error: 'Please sign in again' }
  const sipHost = livekitSipHost()
  if (!sipHost) return { ok: false, error: 'Phone calls are not switched on for this app yet (LIVEKIT_SIP_URI).' }

  const existing = await prismaClient.phoneLine.findFirst({
    where: { workspaceId: owner.business.workspaceId },
    select: { phoneNumber: true },
  })
  if (existing) return { ok: false, error: `${existing.phoneNumber} is already connected. Disconnect it first.` }

  const numbers = await listTwilioNumbers(auth)
  if (!numbers.ok) return numbers
  const number = numbers.result.find((candidate) => candidate.sid === input.numberSid)
  if (!number) return { ok: false, error: 'That number is not on this Twilio account' }
  if (number.trunkSid) {
    return { ok: false, error: `${number.phoneNumber} is already on a SIP trunk in Twilio. Pick another number or remove it from that trunk.` }
  }

  const label = owner.business.name
  const trunk = await createTwilioTrunkToLiveKit(auth, { name: `${label} AI`, livekitSipHost: sipHost, numberSid: number.sid })
  if (!trunk.ok) return { ok: false, error: `Twilio: ${trunk.error}` }

  const routing = await createPhoneRouting({ phoneNumber: number.phoneNumber, roomName: owner.business.roomName, label })
  if (!routing.ok) {
    await deleteTwilioTrunk(auth, trunk.result)
    return routing
  }

  await prismaClient.phoneLine.create({
    data: {
      workspaceId: owner.business.workspaceId,
      userId: owner.userId,
      twilioAccountSid: auth.accountSid,
      twilioAuthTokenEnc: encryptToken(auth.authToken),
      phoneNumber: number.phoneNumber,
      twilioNumberSid: number.sid,
      twilioTrunkSid: trunk.result,
      livekitInboundTrunkId: routing.trunkId,
      livekitDispatchRuleId: routing.ruleId,
    },
  })
  revalidatePath('/integrations')
  return { ok: true, status: await getPhoneSetup() }
}

/** Removes the LiveKit routing and the Twilio trunk; the number keeps its own Twilio settings. */
export async function disconnectPhoneLine(): Promise<Result> {
  const owner = await requireBusiness()
  if (!owner) return { ok: false, error: 'Please sign in again' }
  const row = await prismaClient.phoneLine.findFirst({
    where: { workspaceId: owner.business.workspaceId, userId: owner.userId },
  })
  if (!row) return { ok: true }

  await deletePhoneRouting({ trunkId: row.livekitInboundTrunkId, ruleId: row.livekitDispatchRuleId })
  const authToken = decryptToken(row.twilioAuthTokenEnc)
  if (authToken && row.twilioTrunkSid) {
    const removed = await deleteTwilioTrunk({ accountSid: row.twilioAccountSid, authToken }, row.twilioTrunkSid)
    if (!removed.ok) console.warn('[phone] Twilio trunk not removed:', removed.error)
  }
  await prismaClient.phoneLine.delete({ where: { workspaceId: row.workspaceId } })
  revalidatePath('/integrations')
  return { ok: true }
}
