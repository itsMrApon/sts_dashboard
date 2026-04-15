-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SENT', 'SKIPPED');

-- CreateEnum
CREATE TYPE "OutreachPlatform" AS ENUM ('EMAIL', 'WHATSAPP', 'INSTAGRAM_DM', 'FACEBOOK_DM', 'TIKTOK_DM');

-- AlterTable
ALTER TABLE "CampaignLead" ADD COLUMN     "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
ADD COLUMN     "businessName" VARCHAR(255),
ADD COLUMN     "editedMessage" TEXT,
ADD COLUMN     "generatedMessage" TEXT;

-- CreateTable
CREATE TABLE "OutreachChannel" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "platform" "OutreachPlatform" NOT NULL,
    "status" "ChannelStatus" NOT NULL DEFAULT 'INACTIVE',
    "credentials" JSONB,
    "accountLabel" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachChannel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutreachChannel_userId_idx" ON "OutreachChannel"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachChannel_userId_platform_key" ON "OutreachChannel"("userId", "platform");

-- CreateIndex
CREATE INDEX "CampaignLead_approvalStatus_idx" ON "CampaignLead"("approvalStatus");

-- AddForeignKey
ALTER TABLE "OutreachChannel" ADD CONSTRAINT "OutreachChannel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
