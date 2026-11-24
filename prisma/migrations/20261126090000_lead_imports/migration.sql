-- /lead/intel: apps that send leads in, each import as a batch, and which app each lead field comes from.
CREATE TABLE "LeadImportSource" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "app" VARCHAR(20) NOT NULL,
    "webhookTokenEnc" TEXT,
    "webhookTokenHash" VARCHAR(64),
    "mapping" JSONB,
    "lastColumns" JSONB,
    "lastImportAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeadImportSource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LeadImportSource_webhookTokenHash_key" ON "LeadImportSource"("webhookTokenHash");
CREATE UNIQUE INDEX "LeadImportSource_userId_app_key" ON "LeadImportSource"("userId", "app");
ALTER TABLE "LeadImportSource" ADD CONSTRAINT "LeadImportSource_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LeadImportBatch" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "app" VARCHAR(20) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadImportBatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LeadImportBatch_userId_createdAt_idx" ON "LeadImportBatch"("userId", "createdAt");
CREATE INDEX "LeadImportBatch_sourceId_idx" ON "LeadImportBatch"("sourceId");
ALTER TABLE "LeadImportBatch" ADD CONSTRAINT "LeadImportBatch_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadImportBatch" ADD CONSTRAINT "LeadImportBatch_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "LeadImportSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CallIntelLead"
  ADD COLUMN "importApp" VARCHAR(20),
  ADD COLUMN "importBatchId" UUID;
CREATE INDEX "CallIntelLead_importBatchId_idx" ON "CallIntelLead"("importBatchId");
ALTER TABLE "CallIntelLead" ADD CONSTRAINT "CallIntelLead_importBatchId_fkey"
  FOREIGN KEY ("importBatchId") REFERENCES "LeadImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CallIntelSettings" ADD COLUMN "leadFieldSources" JSONB;
