-- Single-business model: 1 creator = 1 workspace (Tenant) = 1 business profile (Business) = 1 shared AI.
-- Fresh start (approved): clear business-scoped data so the one-per-user constraints can be added.
-- Kept: users, credentials, webinars/projects, leads, call intel, LiveKitAgent rows.

DELETE FROM "VoiceWizardClip";
DELETE FROM "VoiceWizard";
DELETE FROM "RoomEmbedConfig";
DELETE FROM "MessageConversation";
DELETE FROM "MessageChannel";
DELETE FROM "BusinessAgent";
DELETE FROM "BusinessProduct";
DELETE FROM "TenantInboundConnector";
DELETE FROM "OutreachChannel";
UPDATE "Webinar" SET "workspaceId" = NULL WHERE "workspaceId" IS NOT NULL;
DELETE FROM "Tenant";
DELETE FROM "Business";

-- One per creator
CREATE UNIQUE INDEX "Tenant_userId_key" ON "Tenant"("userId");
CREATE UNIQUE INDEX "Business_userId_key" ON "Business"("userId");

-- Site key → business lookup (SHA-256 hash)
CREATE UNIQUE INDEX "RoomEmbedConfig_siteKeyHash_key" ON "RoomEmbedConfig"("siteKeyHash");

-- Website services
CREATE TYPE "WebServiceKind" AS ENUM ('CHAT', 'SPEAK', 'FORM');

CREATE TABLE "ServiceConfig" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspaceId" UUID NOT NULL,
    "kind" "WebServiceKind" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ServiceConfig_workspaceId_kind_key" ON "ServiceConfig"("workspaceId", "kind");
ALTER TABLE "ServiceConfig" ADD CONSTRAINT "ServiceConfig_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FormSubmission" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspaceId" UUID NOT NULL,
    "fields" JSONB NOT NULL,
    "source" VARCHAR(32) NOT NULL DEFAULT 'sdk',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FormSubmission_workspaceId_createdAt_idx" ON "FormSubmission"("workspaceId", "createdAt");
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
