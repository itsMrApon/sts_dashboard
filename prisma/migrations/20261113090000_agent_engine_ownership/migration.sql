-- LiveKit agents get an owner. Existing rows stay NULL and are claimed on first authorized edit.
ALTER TABLE "LiveKitAgent" ADD COLUMN IF NOT EXISTS "userId" UUID;
CREATE INDEX IF NOT EXISTS "LiveKitAgent_userId_idx" ON "LiveKitAgent"("userId");
ALTER TABLE "LiveKitAgent"
  ADD CONSTRAINT "LiveKitAgent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill owners for business agents (BusinessAgent -> Business.userId; Prisma models PublishAgent/PublishProfile).
UPDATE "LiveKitAgent" a
SET "userId" = p."userId"
FROM "BusinessAgent" pa
JOIN "Business" p ON p."id" = pa."businessId"
WHERE pa."agentId" = a."id" AND a."userId" IS NULL;

-- Account-wide engine settings (LLM + voice) applied to every agent the user owns.
CREATE TABLE IF NOT EXISTS "AgentEngineSettings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "llmProvider" VARCHAR(50) NOT NULL DEFAULT 'google',
  "llmModel" VARCHAR(100) NOT NULL,
  "voiceProvider" VARCHAR(50) NOT NULL DEFAULT 'deepgram',
  "voiceModel" VARCHAR(100) NOT NULL DEFAULT 'aura-asteria-en',
  "voiceLabel" VARCHAR(200),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentEngineSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AgentEngineSettings_userId_key" ON "AgentEngineSettings"("userId");
ALTER TABLE "AgentEngineSettings"
  ADD CONSTRAINT "AgentEngineSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
