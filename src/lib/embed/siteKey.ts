import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>

const LEGACY_SCRYPT_KEY_LEN = 64
const SITE_KEY_PREFIX = 'sts_pk_live_'
const SHA256_HASH_PREFIX = 'sha256:'
/** 24 random bytes → 32 base64url chars. */
const SITE_KEY_PATTERN = /^sts_pk_live_[A-Za-z0-9_-]{32}$/

export function generateSiteKey(): string {
  return `${SITE_KEY_PREFIX}${randomBytes(24).toString('base64url')}`
}

export function siteKeyDisplayPrefix(siteKey: string): string {
  if (siteKey.length <= 20) return siteKey
  return `${siteKey.slice(0, 20)}…`
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

/**
 * Site keys are high-entropy random strings (publishable, like Stripe `pk_`),
 * so a fast SHA-256 is sufficient — no slow KDF on the request path.
 */
export function hashSiteKey(siteKey: string): string {
  return `${SHA256_HASH_PREFIX}${sha256(siteKey).toString('base64url')}`
}

export type SiteKeyVerification = { ok: boolean; needsRehash: boolean }

export async function verifySiteKey(siteKey: string, stored: string): Promise<SiteKeyVerification> {
  // Reject malformed input before any hashing (cheap path for junk / brute-force traffic).
  if (!SITE_KEY_PATTERN.test(siteKey) || !stored) return { ok: false, needsRehash: false }

  if (stored.startsWith(SHA256_HASH_PREFIX)) {
    const expected = Buffer.from(stored.slice(SHA256_HASH_PREFIX.length), 'base64url')
    const actual = sha256(siteKey)
    const ok = expected.length === actual.length && timingSafeEqual(expected, actual)
    return { ok, needsRehash: false }
  }

  // Legacy `base64salt:base64hash` scrypt format — async so it never blocks the event loop.
  const [saltB64, hashB64] = stored.split(':')
  if (!saltB64 || !hashB64) return { ok: false, needsRehash: false }
  try {
    const expected = Buffer.from(hashB64, 'base64')
    const actual = await scrypt(siteKey, Buffer.from(saltB64, 'base64'), LEGACY_SCRYPT_KEY_LEN)
    const ok = expected.length === actual.length && timingSafeEqual(expected, actual)
    return { ok, needsRehash: ok }
  } catch {
    return { ok: false, needsRehash: false }
  }
}
