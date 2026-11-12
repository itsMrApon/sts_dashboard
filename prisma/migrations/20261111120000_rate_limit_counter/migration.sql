CREATE TABLE IF NOT EXISTS "RateLimitCounter" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "resetAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RateLimitCounter_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "RateLimitCounter_resetAt_idx" ON "RateLimitCounter"("resetAt");
