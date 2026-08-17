-- AlterTable
ALTER TABLE "UserVoiceCredential" ADD COLUMN IF NOT EXISTS "fishApiKey" TEXT;
ALTER TABLE "UserVoiceCredential" ADD COLUMN IF NOT EXISTS "deepseekApiKey" TEXT;
ALTER TABLE "UserVoiceCredential" ADD COLUMN IF NOT EXISTS "kimiApiKey" TEXT;
ALTER TABLE "UserVoiceCredential" ADD COLUMN IF NOT EXISTS "fishValidatedAt" TIMESTAMP(3);
ALTER TABLE "UserVoiceCredential" ADD COLUMN IF NOT EXISTS "deepseekValidatedAt" TIMESTAMP(3);
ALTER TABLE "UserVoiceCredential" ADD COLUMN IF NOT EXISTS "kimiValidatedAt" TIMESTAMP(3);
