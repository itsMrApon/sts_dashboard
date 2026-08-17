CREATE TABLE IF NOT EXISTS "ProviderUsageDaily" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "provider" VARCHAR(32) NOT NULL,
  "kind" VARCHAR(8) NOT NULL,
  "day" DATE NOT NULL,
  "requestCount" INTEGER NOT NULL DEFAULT 0,
  "inputUnits" BIGINT NOT NULL DEFAULT 0,
  "outputUnits" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProviderUsageDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProviderUsageDaily_userId_provider_kind_day_key"
  ON "ProviderUsageDaily"("userId", "provider", "kind", "day");

CREATE INDEX IF NOT EXISTS "ProviderUsageDaily_userId_day_idx"
  ON "ProviderUsageDaily"("userId", "day");

CREATE INDEX IF NOT EXISTS "ProviderUsageDaily_userId_kind_day_idx"
  ON "ProviderUsageDaily"("userId", "kind", "day");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProviderUsageDaily_userId_fkey'
  ) THEN
    ALTER TABLE "ProviderUsageDaily"
      ADD CONSTRAINT "ProviderUsageDaily_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
