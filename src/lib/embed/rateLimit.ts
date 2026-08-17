type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

const pruneEvery = 500
let ops = 0

function prune(now: number) {
  ops += 1
  if (ops % pruneEvery !== 0) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; remaining: 0; resetAt: number; retryAfterSec: number }

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now()
  prune(now)

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })
    return { ok: true, remaining: limit - 1, resetAt }
  }

  if (bucket.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    return { ok: false, remaining: 0, resetAt: bucket.resetAt, retryAfterSec }
  }

  bucket.count += 1
  return { ok: true, remaining: limit - bucket.count, resetAt: bucket.resetAt }
}

export const EMBED_RATE_LIMITS = {
  bootstrap: { limit: 30, windowMs: 60_000 },
  chat: { limit: 20, windowMs: 60_000 },
  chatIp: { limit: 60, windowMs: 60_000 },
  voice: { limit: 10, windowMs: 60_000 },
  mobile: { limit: 5, windowMs: 3_600_000 },
} as const
