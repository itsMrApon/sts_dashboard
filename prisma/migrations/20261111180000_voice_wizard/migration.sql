CREATE TABLE IF NOT EXISTS "VoiceWizard" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "workspaceId" UUID,
  "slug" VARCHAR(80) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "guideName" VARCHAR(60) NOT NULL DEFAULT 'Nova',
  "language" VARCHAR(8) NOT NULL DEFAULT 'en',
  "voice" VARCHAR(64) NOT NULL DEFAULT 'aura-2-thalia-en',
  "theme" VARCHAR(32) NOT NULL DEFAULT 'obsidian',
  "shape" VARCHAR(16) NOT NULL DEFAULT 'circle',
  "steps" JSONB NOT NULL DEFAULT '[]',
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VoiceWizard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VoiceWizard_slug_key" ON "VoiceWizard"("slug");
CREATE INDEX IF NOT EXISTS "VoiceWizard_userId_idx" ON "VoiceWizard"("userId");
CREATE INDEX IF NOT EXISTS "VoiceWizard_workspaceId_idx" ON "VoiceWizard"("workspaceId");

ALTER TABLE "VoiceWizard" ADD CONSTRAINT "VoiceWizard_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VoiceWizard" ADD CONSTRAINT "VoiceWizard_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "VoiceWizardClip" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "wizardId" UUID NOT NULL,
  "textHash" VARCHAR(64) NOT NULL,
  "mimeType" VARCHAR(32) NOT NULL DEFAULT 'audio/mpeg',
  "audio" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VoiceWizardClip_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VoiceWizardClip_wizardId_textHash_key"
  ON "VoiceWizardClip"("wizardId", "textHash");

ALTER TABLE "VoiceWizardClip" ADD CONSTRAINT "VoiceWizardClip_wizardId_fkey"
  FOREIGN KEY ("wizardId") REFERENCES "VoiceWizard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
