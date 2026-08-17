import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const SALT_LEN = 16
const KEY_LEN = 64
const SITE_KEY_PREFIX = 'sts_pk_live_'

export function generateSiteKey(): string {
  const raw = randomBytes(24).toString('base64url')
  return `${SITE_KEY_PREFIX}${raw}`
}

export function siteKeyDisplayPrefix(siteKey: string): string {
  if (siteKey.length <= 20) return siteKey
  return `${siteKey.slice(0, 20)}…`
}

function deriveKey(siteKey: string, salt: Buffer): Buffer {
  return scryptSync(siteKey, salt, KEY_LEN)
}

/** Persist as `base64salt:base64hash` */
export function hashSiteKey(siteKey: string): string {
  const salt = randomBytes(SALT_LEN)
  const derived = deriveKey(siteKey, salt)
  return `${salt.toString('base64')}:${derived.toString('base64')}`
}

export function verifySiteKey(siteKey: string, stored: string): boolean {
  const [saltB64, hashB64] = stored.split(':')
  if (!saltB64 || !hashB64) return false
  try {
    const salt = Buffer.from(saltB64, 'base64')
    const expected = Buffer.from(hashB64, 'base64')
    const actual = deriveKey(siteKey, salt)
    if (expected.length !== actual.length) return false
    return timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}
