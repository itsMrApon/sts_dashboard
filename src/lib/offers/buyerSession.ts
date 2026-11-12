import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

/**
 * Remembers a buyer's lead (Contact) per creator so the share link only asks once.
 * No login and no one-time code by design: the cookie is HMAC-signed so a buyer can't swap in
 * another contact id, and it is scoped to one creator (one cookie per creator).
 */

const COOKIE_PREFIX = 'stsb_'
const MAX_AGE_SECONDS = 180 * 24 * 60 * 60

let cachedSecret: Buffer | null = null

function secret(): Buffer {
  if (cachedSecret) return cachedSecret
  const explicit = process.env.BUYER_SESSION_SECRET?.trim()
  const clerk = process.env.CLERK_SECRET_KEY?.trim()
  if (explicit) cachedSecret = Buffer.from(explicit, 'utf8')
  else if (clerk) cachedSecret = createHmac('sha256', clerk).update('sts-buyer-session-v1').digest()
  else throw new Error('Set BUYER_SESSION_SECRET (or CLERK_SECRET_KEY) to sign buyer sessions')
  return cachedSecret
}

function cookieName(creatorUserId: string): string {
  return `${COOKIE_PREFIX}${creatorUserId.replace(/-/g, '').slice(0, 12)}`
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

function encode(creatorUserId: string, contactId: string): string {
  const payload = `${creatorUserId}.${contactId}`
  return `${contactId}.${sign(payload)}`
}

export async function setBuyerContact(creatorUserId: string, contactId: string): Promise<void> {
  const store = await cookies()
  store.set(cookieName(creatorUserId), encode(creatorUserId, contactId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}

/** The verified contact id for this creator, or null. */
export async function getBuyerContactId(creatorUserId: string): Promise<string | null> {
  const store = await cookies()
  const raw = store.get(cookieName(creatorUserId))?.value
  if (!raw) return null
  const [contactId, signature] = raw.split('.')
  if (!contactId || !signature) return null
  const expected = Buffer.from(sign(`${creatorUserId}.${contactId}`))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  return contactId
}

export async function clearBuyerContact(creatorUserId: string): Promise<void> {
  const store = await cookies()
  store.delete(cookieName(creatorUserId))
}
