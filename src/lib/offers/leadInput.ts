/**
 * Lead fields from the share link: an email or a WhatsApp number, plus an optional name.
 * Names keep their original Unicode (Bangla included); only trimmed and length-capped.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NAME_MAX = 100

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase()
  return email.length <= 255 && EMAIL_RE.test(email) ? email : null
}

/**
 * E.164-style number. US-first: a bare 10-digit number gets +1. Anything else must include
 * its country code (8 to 15 digits).
 */
export function normalizePhone(value: string): string | null {
  const trimmed = value.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (!trimmed.startsWith('+') && digits.length === 10) return `+1${digits}`
  if (digits.length < 8 || digits.length > 15) return null
  return `+${digits}`
}

export function normalizeName(value: string | null | undefined): string | null {
  const name = value?.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX)
  return name || null
}

/** Campaign tag from ?src= (e.g. whatsapp, email, instagram). */
export function normalizeSource(value: string | null | undefined): string | null {
  const source = value?.trim().toLowerCase().slice(0, 32)
  return source && /^[a-z0-9_-]+$/.test(source) ? source : null
}
