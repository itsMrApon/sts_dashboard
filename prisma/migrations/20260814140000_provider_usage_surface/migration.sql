ALTER TABLE "ProviderUsageDaily"
  ADD COLUMN IF NOT EXISTS "surface" VARCHAR(32) NOT NULL DEFAULT 'app';

DROP INDEX IF EXISTS "ProviderUsageDaily_userId_provider_kind_day_key";

CREATE UNIQUE INDEX IF NOT EXISTS "ProviderUsageDaily_userId_provider_kind_surface_day_key"
  ON "ProviderUsageDaily"("userId", "provider", "kind", "surface", "day");

CREATE INDEX IF NOT EXISTS "ProviderUsageDaily_userId_surface_day_idx"
  ON "ProviderUsageDaily"("userId", "surface", "day");
