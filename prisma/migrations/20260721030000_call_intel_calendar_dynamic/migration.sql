-- AlterTable
ALTER TABLE "CallIntelSettings" ADD COLUMN IF NOT EXISTS "calendarFilterMode" VARCHAR(20) NOT NULL DEFAULT 'ALL';
ALTER TABLE "CallIntelSettings" ADD COLUMN IF NOT EXISTS "calendarKeyword" VARCHAR(100);
ALTER TABLE "CallIntelSettings" ADD COLUMN IF NOT EXISTS "googleClientIdEnc" TEXT;
ALTER TABLE "CallIntelSettings" ADD COLUMN IF NOT EXISTS "googleClientSecretEnc" TEXT;
