-- CreateEnum
CREATE TYPE "LeadOutboundStatus" AS ENUM ('NEW', 'ON_PROCESS', 'DONE');

-- CreateEnum
CREATE TYPE "LeadSearchBatchSource" AS ENUM ('CRON', 'MANUAL');

-- CreateEnum
CREATE TYPE "LeadActivityType" AS ENUM ('NOTE', 'APPROACH', 'FOLLOW_UP', 'MEET_SCHEDULED');

-- CreateTable
CREATE TABLE "LeadSearchBatch" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "location" VARCHAR(255) NOT NULL,
    "niche" VARCHAR(255) NOT NULL,
    "source" "LeadSearchBatchSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadSearchBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "type" "LeadActivityType" NOT NULL,
    "note" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "googleEventId" VARCHAR(255),
    "meetLink" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CallIntelLead" ADD COLUMN "outboundStatus" "LeadOutboundStatus" NOT NULL DEFAULT 'NEW';
ALTER TABLE "CallIntelLead" ADD COLUMN "searchBatchId" UUID;
ALTER TABLE "CallIntelLead" ADD COLUMN "nextFollowUpAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "LeadSearchBatch_userId_idx" ON "LeadSearchBatch"("userId");
CREATE INDEX "LeadSearchBatch_userId_createdAt_idx" ON "LeadSearchBatch"("userId", "createdAt");
CREATE INDEX "LeadActivity_userId_idx" ON "LeadActivity"("userId");
CREATE INDEX "LeadActivity_leadId_idx" ON "LeadActivity"("leadId");
CREATE INDEX "LeadActivity_userId_scheduledAt_idx" ON "LeadActivity"("userId", "scheduledAt");
CREATE INDEX "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt");
CREATE INDEX "CallIntelLead_userId_outboundStatus_idx" ON "CallIntelLead"("userId", "outboundStatus");
CREATE INDEX "CallIntelLead_searchBatchId_idx" ON "CallIntelLead"("searchBatchId");
CREATE INDEX "CallIntelLead_userId_nextFollowUpAt_idx" ON "CallIntelLead"("userId", "nextFollowUpAt");

-- AddForeignKey
ALTER TABLE "LeadSearchBatch" ADD CONSTRAINT "LeadSearchBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CallIntelLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CallIntelLead" ADD CONSTRAINT "CallIntelLead_searchBatchId_fkey" FOREIGN KEY ("searchBatchId") REFERENCES "LeadSearchBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
