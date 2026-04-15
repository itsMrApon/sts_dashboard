-- Drop campaign lead pipeline; rename Campaign -> Tenant; rename campaignId -> tenantId; scope outreach by business.

DROP TABLE IF EXISTS "CampaignLead";

ALTER TABLE "Campaign" RENAME TO "Tenant";

ALTER TABLE "Tenant" RENAME CONSTRAINT "Campaign_pkey" TO "Tenant_pkey";
ALTER TABLE "Tenant" RENAME CONSTRAINT "Campaign_userId_fkey" TO "Tenant_userId_fkey";

ALTER INDEX "Campaign_userId_idx" RENAME TO "Tenant_userId_idx";
DROP INDEX IF EXISTS "Campaign_status_idx";

ALTER TABLE "Tenant"
  DROP COLUMN "status",
  DROP COLUMN "niche",
  DROP COLUMN "location",
  DROP COLUMN "sources",
  DROP COLUMN "channels",
  DROP COLUMN "useTelegram",
  DROP COLUMN "useEmail",
  DROP COLUMN "useWhatsApp",
  DROP COLUMN "totalLeads",
  DROP COLUMN "emailsSent",
  DROP COLUMN "messagesSent",
  DROP COLUMN "roomJoins",
  DROP COLUMN "conversions";

DROP TYPE "CampaignStatus";

ALTER TABLE "Tenant" ADD COLUMN "businessId" UUID;

ALTER TABLE "Tenant"
  ADD CONSTRAINT "Tenant_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Tenant_businessId_idx" ON "Tenant"("businessId");

UPDATE "Tenant" t
SET "businessId" = b.id
FROM (
  SELECT DISTINCT ON ("userId") id, "userId"
  FROM "Business"
  ORDER BY "userId", "createdAt" ASC
) b
WHERE t."userId" = b."userId";

ALTER TABLE "MessageChannel" RENAME COLUMN "campaignId" TO "tenantId";

CREATE INDEX "MessageChannel_tenantId_idx" ON "MessageChannel"("tenantId");

ALTER TABLE "MessageChannel"
  ADD CONSTRAINT "MessageChannel_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EventLog" RENAME COLUMN "campaignId" TO "tenantId";
ALTER INDEX "EventLog_campaignId_idx" RENAME TO "EventLog_tenantId_idx";

ALTER TABLE "CallTranscript" RENAME COLUMN "campaignId" TO "tenantId";

ALTER TABLE "OutreachChannel" ADD COLUMN "businessId" UUID;

ALTER TABLE "OutreachChannel"
  ADD CONSTRAINT "OutreachChannel_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "OutreachChannel_businessId_idx" ON "OutreachChannel"("businessId");

UPDATE "OutreachChannel" o
SET "businessId" = b.id
FROM (
  SELECT DISTINCT ON ("userId") id, "userId"
  FROM "Business"
  ORDER BY "userId", "createdAt" ASC
) b
WHERE o."userId" = b."userId";
