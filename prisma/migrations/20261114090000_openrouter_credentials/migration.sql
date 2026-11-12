-- OpenRouter key + validation timestamps for every LLM provider (all nullable, additive).
ALTER TABLE "UserVoiceCredential" ADD COLUMN IF NOT EXISTS "openrouterApiKey" TEXT;
ALTER TABLE "UserVoiceCredential" ADD COLUMN IF NOT EXISTS "openaiValidatedAt" TIMESTAMP(3);
ALTER TABLE "UserVoiceCredential" ADD COLUMN IF NOT EXISTS "anthropicValidatedAt" TIMESTAMP(3);
ALTER TABLE "UserVoiceCredential" ADD COLUMN IF NOT EXISTS "openrouterValidatedAt" TIMESTAMP(3);
