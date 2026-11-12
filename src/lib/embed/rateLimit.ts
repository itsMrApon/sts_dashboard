import { prismaClient } from '@/lib/prismaClient'

/**
 * Fixed-window counters stored in Postgres so limits hold across serverless instances.
 * Falls back to a per-instance memory window if the DB is unreachable (degraded, not open).
 */

export type RateLimitRule = { limit: number; windowMs: number }

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; remaining: 0; resetAt: number; retryAfterSec: number }

type MemoryBucket = { count: number; resetAt: number }

const memoryBuckets = new Map<string, MemoryBucket>()
const CLEANUP_PROBABILITY = 0.005

function evaluate(count: number, limit: number, resetAt: number, now: number): RateLimitResult {
  if (count > limit) {
    return {
      ok: false,
      remaining: 0,
      resetAt,
      retryAfterSec: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    }
  }
  return { ok: true, remaining: limit - count, resetAt }
}

function incrementInMemory(key: string, resetAtIfNew: number, now: number) {
  if (memoryBuckets.size > 10_000) {
    for (const [bucketKey, bucket] of memoryBuckets) {
      if (bucket.resetAt <= now) memoryBuckets.delete(bucketKey)
    }
  }
  const bucket = memoryBuckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    const fresh = { count: 1, resetAt: resetAtIfNew }
    memoryBuckets.set(key, fresh)
    return fresh
  }
  bucket.count += 1
  return bucket
}

async function incrementInDb(key: string, resetAtIfNew: number, now: number) {
  const nowDate = new Date(now)
  const rows = await prismaClient.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimitCounter" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${new Date(resetAtIfNew)})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitCounter"."resetAt" <= ${nowDate} THEN 1
                     ELSE "RateLimitCounter"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitCounter"."resetAt" <= ${nowDate} THEN EXCLUDED."resetAt"
                       ELSE "RateLimitCounter"."resetAt" END
    RETURNING "count", "resetAt"`

  if (Math.random() < CLEANUP_PROBABILITY) {
    void prismaClient
      .$executeRaw`DELETE FROM "RateLimitCounter" WHERE "resetAt" < ${new Date(now - 3_600_000)}`
      .catch(() => undefined)
  }

  const row = rows[0]
  return { count: Number(row.count), resetAt: row.resetAt.getTime() }
}

async function consume(key: string, limit: number, resetAtIfNew: number): Promise<RateLimitResult> {
  const now = Date.now()
  try {
    const bucket = await incrementInDb(key, resetAtIfNew, now)
    return evaluate(bucket.count, limit, bucket.resetAt, now)
  } catch (error) {
    console.warn('[rate-limit] DB counter unavailable, using memory fallback', error)
    const bucket = incrementInMemory(key, resetAtIfNew, now)
    return evaluate(bucket.count, limit, bucket.resetAt, now)
  }
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  return consume(`rl:${key}`, limit, Date.now() + windowMs)
}

/** Daily usage cap that resets at UTC midnight. */
export function consumeDailyQuota(key: string, limit: number): Promise<RateLimitResult> {
  const now = new Date()
  const day = now.toISOString().slice(0, 10)
  const nextUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  return consume(`quota:${key}:${day}`, limit, nextUtcMidnight)
}

export const EMBED_RATE_LIMITS = {
  /** Session mint per IP + room. */
  session: { limit: 20, windowMs: 60_000 },
  bootstrap: { limit: 30, windowMs: 60_000 },
  chat: { limit: 20, windowMs: 60_000 },
  chatIp: { limit: 60, windowMs: 60_000 },
  voice: { limit: 4, windowMs: 600_000 },
  voiceIp: { limit: 10, windowMs: 60_000 },
  mobile: { limit: 5, windowMs: 3_600_000 },
  /** Read-only SDK calls (form schema, wizard, business profile). */
  read: { limit: 60, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>

function positiveIntFromEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** Per-room daily caps — the backstop against LLM / STT / TTS cost abuse. */
export const EMBED_DAILY_QUOTAS = {
  chat: positiveIntFromEnv('EMBED_DAILY_CHAT_LIMIT', 2000),
  voice: positiveIntFromEnv('EMBED_DAILY_VOICE_SESSION_LIMIT', 200),
  mobile: positiveIntFromEnv('EMBED_DAILY_CALLBACK_LIMIT', 50),
} as const
