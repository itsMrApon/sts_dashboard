-- This migration is a drift-sync shim.
-- The database already has these columns, but they were not captured in migration history.
-- Use IF NOT EXISTS so it can be applied safely without data loss.

-- LiveKitAgent: add llmModel + llmProvider
ALTER TABLE "LiveKitAgent"
ADD COLUMN IF NOT EXISTS "llmModel" VARCHAR(100) NOT NULL DEFAULT 'gemini-2.0-flash';

ALTER TABLE "LiveKitAgent"
ADD COLUMN IF NOT EXISTS "llmProvider" VARCHAR(50) NOT NULL DEFAULT 'google';

-- Webinar: add livekitAgentId
ALTER TABLE "Webinar"
ADD COLUMN IF NOT EXISTS "livekitAgentId" UUID;

