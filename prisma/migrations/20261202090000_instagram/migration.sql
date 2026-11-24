-- Instagram comment-to-DM: connections, keyword campaigns and the DM send queue.
-- CreateTable
CREATE TABLE "InstagramConnection" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "igUserId" VARCHAR(64) NOT NULL,
    "username" VARCHAR(64),
    "accessTokenEnc" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "webhookSubscribed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramCampaign" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "mediaId" VARCHAR(64),
    "mediaCaption" VARCHAR(200),
    "mediaThumb" VARCHAR(1000),
    "keywords" TEXT[],
    "matchMode" VARCHAR(16) NOT NULL DEFAULT 'contains',
    "dmText" TEXT NOT NULL,
    "linkUrl" VARCHAR(500),
    "publicReply" TEXT,
    "askContact" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "contactsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramDmJob" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaignId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "commentId" VARCHAR(64) NOT NULL,
    "commenterId" VARCHAR(64) NOT NULL,
    "commenterUsername" VARCHAR(64),
    "commentText" TEXT NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error" TEXT,
    "leadId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramDmJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstagramConnection_userId_key" ON "InstagramConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramConnection_igUserId_key" ON "InstagramConnection"("igUserId");

-- CreateIndex
CREATE INDEX "InstagramCampaign_userId_active_idx" ON "InstagramCampaign"("userId", "active");

-- CreateIndex
CREATE INDEX "InstagramDmJob_status_nextAttemptAt_idx" ON "InstagramDmJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "InstagramDmJob_userId_commenterId_idx" ON "InstagramDmJob"("userId", "commenterId");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramDmJob_campaignId_commentId_key" ON "InstagramDmJob"("campaignId", "commentId");

-- AddForeignKey
ALTER TABLE "InstagramConnection" ADD CONSTRAINT "InstagramConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramCampaign" ADD CONSTRAINT "InstagramCampaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramDmJob" ADD CONSTRAINT "InstagramDmJob_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "InstagramCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

