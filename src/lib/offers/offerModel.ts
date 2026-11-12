import { randomBytes } from 'node:crypto'
import { OrderModeKind } from '@prisma/client'
import { VARIANT_META, type WebinarLinkVariant } from '@/lib/webinarLinkVariants'

const SLUG_WORDS_MAX = 60

/**
 * Public share slug for /o/{slug}: ascii words from the title plus a random suffix.
 * Titles without ascii letters (e.g. Bangla) fall back to the suffix alone; the title itself is never altered.
 */
export function buildOfferSlug(title: string): string {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_WORDS_MAX)
    .replace(/-+$/g, '')
  const suffix = randomBytes(4).toString('hex')
  return words ? `${words}-${suffix}` : suffix
}

/**
 * Maps the legacy link variants (still produced by the create dialog) to ways to order.
 * Same mapping as the 20261116090000 backfill.
 */
export function orderModesFromVariants(variants: WebinarLinkVariant[]): OrderModeKind[] {
  const modes = new Set<OrderModeKind>()
  for (const variant of variants) {
    const meta = VARIANT_META[variant]
    if (meta.ctaType === 'BOOK_A_CALL') modes.add(OrderModeKind.AI_ASSISTANT)
    else if (meta.kind === 'product') modes.add(OrderModeKind.INSTANT_CHECKOUT)
    else modes.add(OrderModeKind.LIVE_HOST)
  }
  return [...modes]
}

/** Accepts "livekit:<uuid>" (current) or a bare uuid. Anything else is rejected. */
export function parseLiveKitAgentValue(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim()
  const id = raw.startsWith('livekit:') ? raw.slice('livekit:'.length) : raw
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null
}
