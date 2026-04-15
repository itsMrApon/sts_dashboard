-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('LEAD_HUNTED', 'OUTREACH_SENT', 'LINK_CLICKED', 'ROOM_JOINED', 'CALL_STARTED', 'CALL_ENDED', 'MESSAGE_REPLIED', 'PAYMENT_COMPLETED', 'CAMPAIGN_LAUNCHED', 'CAMPAIGN_PAUSED', 'LEAD_CONVERTED', 'LEAD_LOST');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('GOOGLE_MAPS', 'GOOGLE_SEARCH', 'LINKEDIN', 'INSTAGRAM', 'WEBINAR', 'MANUAL');

-- CreateEnum
CREATE TYPE "LeadScore" AS ENUM ('HOT', 'WARM', 'COLD');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "VideoType" AS ENUM ('LINK', 'UPLOAD');

-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "LeadState" AS ENUM ('OUTREACHED', 'OPENED', 'CLICKED_LINK', 'JOINED_ROOM', 'CONVERTED', 'LOST');

-- CreateTable
CREATE TABLE "EventLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "leadId" UUID,
    "campaignId" UUID,
    "eventType" "EventType" NOT NULL,
    "channel" VARCHAR(50),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallTranscript" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "roomName" VARCHAR(255) NOT NULL,
    "leadId" UUID,
    "campaignId" UUID,
    "transcript" JSONB NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "outcome" VARCHAR(50),
    "objections" JSONB,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallTranscript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "webinarId" UUID,
    "name" VARCHAR(255) NOT NULL,
    "pitchMessage" TEXT NOT NULL,
    "videoUrl" VARCHAR(500),
    "videoType" "VideoType" NOT NULL DEFAULT 'LINK',
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "niche" VARCHAR(255),
    "location" VARCHAR(255),
    "sources" TEXT[],
    "useTelegram" BOOLEAN NOT NULL DEFAULT false,
    "useEmail" BOOLEAN NOT NULL DEFAULT false,
    "useWhatsApp" BOOLEAN NOT NULL DEFAULT false,
    "totalLeads" INTEGER NOT NULL DEFAULT 0,
    "emailsSent" INTEGER NOT NULL DEFAULT 0,
    "messagesSent" INTEGER NOT NULL DEFAULT 0,
    "roomJoins" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignLead" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaignId" UUID NOT NULL,
    "huntedLeadId" UUID,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "telegramId" VARCHAR(100),
    "emailStatus" "OutreachStatus" NOT NULL DEFAULT 'PENDING',
    "emailSentAt" TIMESTAMP(3),
    "telegramStatus" "OutreachStatus" NOT NULL DEFAULT 'PENDING',
    "telegramSentAt" TIMESTAMP(3),
    "whatsappStatus" "OutreachStatus" NOT NULL DEFAULT 'PENDING',
    "whatsappSentAt" TIMESTAMP(3),
    "linkClicked" BOOLEAN NOT NULL DEFAULT false,
    "linkClickedAt" TIMESTAMP(3),
    "roomJoined" BOOLEAN NOT NULL DEFAULT false,
    "roomJoinedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "leadState" "LeadState" NOT NULL DEFAULT 'OUTREACHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HuntedLead" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "website" VARCHAR(255),
    "address" VARCHAR(500),
    "businessName" VARCHAR(255),
    "source" "LeadSource" NOT NULL,
    "score" "LeadScore" NOT NULL DEFAULT 'COLD',
    "scoreReason" TEXT,
    "niche" VARCHAR(255),
    "location" VARCHAR(255),
    "rawData" JSONB,
    "outreachSent" BOOLEAN NOT NULL DEFAULT false,
    "outreachChannel" VARCHAR(50),
    "outreachSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HuntedLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HuntSchedule" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "niche" VARCHAR(255) NOT NULL,
    "location" VARCHAR(255) NOT NULL,
    "sources" TEXT[],
    "frequency" VARCHAR(20) NOT NULL DEFAULT 'DAILY',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HuntSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventLog_userId_idx" ON "EventLog"("userId");

-- CreateIndex
CREATE INDEX "EventLog_leadId_idx" ON "EventLog"("leadId");

-- CreateIndex
CREATE INDEX "EventLog_campaignId_idx" ON "EventLog"("campaignId");

-- CreateIndex
CREATE INDEX "EventLog_eventType_idx" ON "EventLog"("eventType");

-- CreateIndex
CREATE INDEX "EventLog_createdAt_idx" ON "EventLog"("createdAt");

-- CreateIndex
CREATE INDEX "CallTranscript_userId_idx" ON "CallTranscript"("userId");

-- CreateIndex
CREATE INDEX "CallTranscript_roomName_idx" ON "CallTranscript"("roomName");

-- CreateIndex
CREATE INDEX "CallTranscript_leadId_idx" ON "CallTranscript"("leadId");

-- CreateIndex
CREATE INDEX "CallTranscript_createdAt_idx" ON "CallTranscript"("createdAt");

-- CreateIndex
CREATE INDEX "Campaign_userId_idx" ON "Campaign"("userId");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "CampaignLead_campaignId_idx" ON "CampaignLead"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignLead_leadState_idx" ON "CampaignLead"("leadState");

-- CreateIndex
CREATE INDEX "CampaignLead_emailStatus_idx" ON "CampaignLead"("emailStatus");

-- CreateIndex
CREATE INDEX "HuntedLead_userId_idx" ON "HuntedLead"("userId");

-- CreateIndex
CREATE INDEX "HuntedLead_source_idx" ON "HuntedLead"("source");

-- CreateIndex
CREATE INDEX "HuntedLead_score_idx" ON "HuntedLead"("score");

-- CreateIndex
CREATE INDEX "HuntedLead_createdAt_idx" ON "HuntedLead"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HuntSchedule_userId_key" ON "HuntSchedule"("userId");

-- CreateIndex
CREATE INDEX "HuntSchedule_userId_idx" ON "HuntSchedule"("userId");

-- CreateIndex
CREATE INDEX "HuntSchedule_enabled_idx" ON "HuntSchedule"("enabled");

-- AddForeignKey
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallTranscript" ADD CONSTRAINT "CallTranscript_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignLead" ADD CONSTRAINT "CampaignLead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuntedLead" ADD CONSTRAINT "HuntedLead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuntSchedule" ADD CONSTRAINT "HuntSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
