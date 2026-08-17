-- CreateEnum
CREATE TYPE "CallIntelProvider" AS ENUM ('FATHOM', 'GOOGLE_CALENDAR');

-- CreateEnum
CREATE TYPE "CallIntelConnectionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR');

-- CreateEnum
CREATE TYPE "CallIntelBriefStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "CallIntelConnection" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "provider" "CallIntelProvider" NOT NULL,
    "credentials" JSONB,
    "status" "CallIntelConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallIntelConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallIntelLead" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "company" VARCHAR(255),
    "notes" TEXT,
    "selectedAgentId" UUID,
    "lastAppointmentAt" TIMESTAMP(3),
    "webResearchJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallIntelLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallIntelMeeting" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "leadId" UUID,
    "fathomRecordingId" VARCHAR(100) NOT NULL,
    "summary" TEXT,
    "actionItems" JSONB,
    "participants" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER,
    "fathomUrl" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallIntelMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallIntelScriptScore" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "meetingId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "covered" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "missed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "issues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nextSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rawJson" JSONB,
    "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallIntelScriptScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallIntelBrief" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "leadId" UUID NOT NULL,
    "forDate" DATE NOT NULL,
    "calendarEventId" VARCHAR(255),
    "formSnapshot" JSONB,
    "researchSnapshot" JSONB,
    "status" "CallIntelBriefStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallIntelBrief_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallIntelConnection_userId_idx" ON "CallIntelConnection"("userId");

-- CreateIndex
CREATE INDEX "CallIntelConnection_provider_idx" ON "CallIntelConnection"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "CallIntelConnection_userId_provider_key" ON "CallIntelConnection"("userId", "provider");

-- CreateIndex
CREATE INDEX "CallIntelLead_userId_idx" ON "CallIntelLead"("userId");

-- CreateIndex
CREATE INDEX "CallIntelLead_userId_lastAppointmentAt_idx" ON "CallIntelLead"("userId", "lastAppointmentAt");

-- CreateIndex
CREATE INDEX "CallIntelLead_selectedAgentId_idx" ON "CallIntelLead"("selectedAgentId");

-- CreateIndex
CREATE UNIQUE INDEX "CallIntelLead_userId_email_key" ON "CallIntelLead"("userId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "CallIntelMeeting_fathomRecordingId_key" ON "CallIntelMeeting"("fathomRecordingId");

-- CreateIndex
CREATE INDEX "CallIntelMeeting_userId_idx" ON "CallIntelMeeting"("userId");

-- CreateIndex
CREATE INDEX "CallIntelMeeting_leadId_idx" ON "CallIntelMeeting"("leadId");

-- CreateIndex
CREATE INDEX "CallIntelMeeting_recordedAt_idx" ON "CallIntelMeeting"("recordedAt");

-- CreateIndex
CREATE INDEX "CallIntelScriptScore_meetingId_idx" ON "CallIntelScriptScore"("meetingId");

-- CreateIndex
CREATE INDEX "CallIntelScriptScore_agentId_idx" ON "CallIntelScriptScore"("agentId");

-- CreateIndex
CREATE INDEX "CallIntelScriptScore_scoredAt_idx" ON "CallIntelScriptScore"("scoredAt");

-- CreateIndex
CREATE INDEX "CallIntelBrief_leadId_idx" ON "CallIntelBrief"("leadId");

-- CreateIndex
CREATE INDEX "CallIntelBrief_forDate_idx" ON "CallIntelBrief"("forDate");

-- CreateIndex
CREATE UNIQUE INDEX "CallIntelBrief_leadId_forDate_calendarEventId_key" ON "CallIntelBrief"("leadId", "forDate", "calendarEventId");

-- AddForeignKey
ALTER TABLE "CallIntelConnection" ADD CONSTRAINT "CallIntelConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallIntelLead" ADD CONSTRAINT "CallIntelLead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallIntelMeeting" ADD CONSTRAINT "CallIntelMeeting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallIntelMeeting" ADD CONSTRAINT "CallIntelMeeting_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CallIntelLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallIntelScriptScore" ADD CONSTRAINT "CallIntelScriptScore_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "CallIntelMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallIntelBrief" ADD CONSTRAINT "CallIntelBrief_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CallIntelLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
